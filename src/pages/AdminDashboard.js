import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, TextInput, FlatList, SectionList, Alert, Platform } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import axios from 'axios';
import { API_URL, storage } from '../api/config';
import { generateTicketsForCart } from '../utils/TicketFormatter';

const { width } = Dimensions.get('window');

import PrinterService, { safePrint } from '../utils/PrinterService';

export default function AdminDashboard({ onBack, btStatus }) {
    const insets = useSafeAreaInsets();
    const [stats, setStats] = useState({ total: 0, revenue: 0, scanned: 0, pending: 0 });

    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isPrinting, setIsPrinting] = useState(false);
    const [debugData, setDebugData] = useState(null);
    const [showDebug, setShowDebug] = useState(false);
    const [lostRecords, setLostRecords] = useState([]);
    const [localArchive, setLocalArchive] = useState([]);
    const [startDate, setStartDate] = useState('2026-05-24');
    const [endDate, setEndDate] = useState('2026-05-29');
    const [viewMode, setViewMode] = useState('server'); // server, local, sync
    const [isSyncing, setIsSyncing] = useState(false);




    const fetchData = async () => {
        setLoading(true);
        try {
            const token = await storage.getToken();
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const user = await storage.getUser();
            const posId = (user.role === 'admin' || user.role === 'superadmin') ? 'all' : 'pos1';

            const [statsRes, ticketsRes, allRes] = await Promise.all([
                axios.get(`${API_URL}/api/tickets/stats?posId=${posId}&startDate=${startDate}&endDate=${endDate}`, config),
                axios.get(`${API_URL}/api/tickets?posId=${posId}&startDate=${startDate}&endDate=${endDate}`, config),
                axios.get(`${API_URL}/api/tickets?limit=500&startDate=${startDate}&endDate=${endDate}`, config) // Full fetch
            ]);

            setStats(statsRes.data);
            
            // Normal view
            const normalTickets = ticketsRes.data.filter(t => !t.parentId);
            setTickets(normalTickets);
            setDebugData(allRes.data);

            // Find "lost" records: present in allRes but not in normalTickets
            const normalIds = new Set(normalTickets.map(t => t.id));
            const lost = allRes.data.filter(t => !normalIds.has(t.id) && !t.parentId);
            setLostRecords(lost);

            // Fetch Local Archive
            const archiveStr = await storage.getItem('local_archive');
            setLocalArchive(archiveStr ? JSON.parse(archiveStr) : []);

        } catch (err) {

            console.error('Admin Fetch Error:', err);
        } finally {
            setLoading(false);
        }
    };



    useEffect(() => {
        fetchData();
    }, []);

    const handleReprint = async (masterTicket) => {
        if (btStatus !== 'connected' && NativePrinter) {
             Alert.alert('Printers Offline', 'Please connect bluetooth in POS screen first.');
             return;
        }

        setIsPrinting(true);
        try {
            const user = await storage.getUser();
            // Fallback for older records or server records that might not have a full 'items' array
            const itemsToUse = masterTicket.items && masterTicket.items.length > 0 
                ? masterTicket.items 
                : (masterTicket.rideName ? [{ 
                    name: masterTicket.rideName, 
                    price: masterTicket.amount || masterTicket.price || 0, 
                    quantity: 1 
                  }] : []);

            if (itemsToUse.length === 0) {
                Alert.alert('Cannot Reprint', 'This record does not contain item details for printing.');
                return;
            }

            const allRecords = generateTicketsForCart(itemsToUse, masterTicket.id, masterTicket.mobile, user, masterTicket.paymentMode || 'UPI');
            const ticketsToPrint = allRecords.filter(t => !t.isMaster);
            
            for (const t of ticketsToPrint) {
                if (t.text) {
                    await safePrint(t.text);
                    await safePrint("\x0a\x1d\x56\x00"); // Standard Cut command
                }
            }

            Alert.alert('Success', 'Reprint command sent to printer.');
        } catch (e) {
            Alert.alert('Reprint Failed', e.message);
        } finally {
            setIsPrinting(false);
        }
    };

    const handleManualSync = async () => {
        setIsSyncing(true);
        try {
            const token = await storage.getToken();
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const user = await storage.getUser();
            
            // 1. Get all successful local records that are NOT marked as synced
            let unsyncedLocal = localArchive.filter(item => {
                const status = item.status ? item.status.toLowerCase() : 'unknown';
                return ['success', 'valid'].includes(status) && !item.synced;
            });
            
            if (unsyncedLocal.length === 0) {
                Alert.alert('Info', 'All successful offline records are already marked as synced.');
                setIsSyncing(false);
                return;
            }

            // 2. Try to fetch recent server records to fast-track some of them
            try {
                const checkRes = await axios.get(`${API_URL}/api/tickets?limit=1000`, config);
                const serverIds = new Set(checkRes.data.map(t => t.id));
                
                for (const item of unsyncedLocal) {
                    if (serverIds.has(item.id)) {
                        item.synced = true;
                    }
                }
                // Filter down to the ones that are still unsynced
                unsyncedLocal = unsyncedLocal.filter(item => !item.synced);
            } catch (e) {
                console.warn('Could not fetch server IDs for fast-tracking', e);
            }

            if (unsyncedLocal.length === 0) {
                await storage.setItem('local_archive', JSON.stringify(localArchive));
                setLocalArchive([...localArchive]);
                Alert.alert('Up to Date', 'All offline records were found on the server and marked as synced.');
                setIsSyncing(false);
                return;
            }

            let successCount = 0;
            let failCount = 0;

            for (const masterTicket of unsyncedLocal) {
                try {
                    const itemsToUse = masterTicket.items && masterTicket.items.length > 0 
                        ? masterTicket.items 
                        : (masterTicket.rideName ? [{ 
                            name: masterTicket.rideName, 
                            price: masterTicket.amount || masterTicket.price || 0, 
                            quantity: 1 
                        }] : []);
                        
                    if (itemsToUse.length === 0) continue;
                    
                    const allRecords = generateTicketsForCart(itemsToUse, masterTicket.id, masterTicket.mobile || '0000000000', user, masterTicket.paymentMode || 'UPI');
                    
                    const originalDate = masterTicket.createdAt || new Date().toISOString();
                    const recordsToSync = allRecords.map(r => ({...r, createdAt: originalDate}));

                    await axios.post(`${API_URL}/api/tickets`, recordsToSync, config);
                    
                    masterTicket.synced = true;
                    successCount++;
                } catch (e) {
                    const errStr = e.response && e.response.data ? JSON.stringify(e.response.data).toLowerCase() : '';
                    if (e.response && (e.response.status === 409 || errStr.includes('duplicate') || errStr.includes('e11000'))) {
                        // Already exists on server
                        masterTicket.synced = true;
                        successCount++;
                    } else {
                        console.error('Failed to sync ticket', masterTicket.id, e.message);
                        failCount++;
                    }
                }
                
                // Small delay to prevent rate limit / overwhelming server
                await new Promise(r => setTimeout(r, 150));
            }

            await storage.setItem('local_archive', JSON.stringify(localArchive));
            setLocalArchive([...localArchive]);
            
            Alert.alert('Sync Complete', `Successfully synced ${successCount} missing records.${failCount > 0 ? `\nFailed: ${failCount}` : ''}`);
            
            fetchData();
        } catch (error) {
            console.error('Manual Sync Error:', error);
            Alert.alert('Sync Error', 'An error occurred while checking or syncing records.');
        } finally {
            setIsSyncing(false);
        }
    };

    const filteredTickets = tickets.filter(t => 
        (t.id && t.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.mobile && t.mobile.includes(searchTerm))
    );

    const filteredArchive = localArchive.filter(t => 
        (t.id && t.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.mobile && t.mobile.includes(searchTerm))
    );

    const getGroupedTickets = (ticketsData) => {
        const groups = {};
        ticketsData.forEach(t => {
            const dateObj = new Date(t.createdAt);
            const dateStr = dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(t);
        });
        const sections = Object.keys(groups).map(date => {
            const data = groups[date];
            
            const upiTotal = data.reduce((sum, item) => {
                const status = item.status ? item.status.toLowerCase() : (viewMode === 'server' ? 'success' : 'unknown');
                const isSuccess = ['success', 'valid'].includes(status);
                const isUpi = !item.paymentMode || item.paymentMode.toUpperCase() === 'UPI';
                return sum + (isSuccess && isUpi ? (parseFloat(item.amount) || 0) : 0);
            }, 0);

            const cashTotal = data.reduce((sum, item) => {
                const status = item.status ? item.status.toLowerCase() : (viewMode === 'server' ? 'success' : 'unknown');
                const isSuccess = ['success', 'valid'].includes(status);
                const isCash = item.paymentMode && item.paymentMode.toUpperCase() === 'CASH';
                return sum + (isSuccess && isCash ? (parseFloat(item.amount) || 0) : 0);
            }, 0);

            const dailyTotal = upiTotal + cashTotal;

            const failedTotal = data.reduce((sum, item) => {
                const status = item.status ? item.status.toLowerCase() : (viewMode === 'server' ? 'success' : 'unknown');
                const isFailed = ['failed', 'error'].includes(status);
                return sum + (isFailed ? (parseFloat(item.amount) || 0) : 0);
            }, 0);
            const cancelledCount = data.filter(item => item.status && item.status.toLowerCase() === 'cancelled').length;
            return { title: date, data, rawDate: data[0].createdAt, dailyTotal, upiTotal, cashTotal, failedTotal, cancelledCount };
        });
        sections.sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));
        return sections;
    };

    if (loading) return (
        <View style={styles.center}><ActivityIndicator size="large" color="#0084c2" /></View>
    );

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <View style={styles.brandRow}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Ionicons name="apps" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={{flex: 1}}>
                        <Text style={styles.headerTitle}>ETHREE <Text style={{color:'#3b82f6'}}>ADMIN</Text></Text>
                        <Text style={styles.headerSub}>MANAGEMENT & REPRINT CONSOLE</Text>
                    </View>
                    <View style={styles.headerActions}>
                        <TouchableOpacity 
                            onPress={() => Alert.alert('Printer Sync', 'To reconnect printer, please go back to the POS screen and click the status button.')}
                            style={[styles.btBadge, {backgroundColor: btStatus === 'connected' ? '#10b981' : '#64748b'}]}
                        >
                            <Ionicons name="bluetooth" size={10} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowDebug(!showDebug)} style={styles.actionBtn}>
                            <Ionicons name="bug-outline" size={18} color={showDebug ? "#f0c05a" : "#fff"} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={fetchData} style={styles.actionBtn}>
                            <Ionicons name="refresh" size={18} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
                <View style={styles.dateFilterRow}>
                    <TextInput 
                        style={styles.dateInput} 
                        value={startDate} 
                        onChangeText={setStartDate} 
                        placeholder="YYYY-MM-DD" 
                        placeholderTextColor="#94a3b8"
                    />
                    <Text style={{color: '#fff', marginHorizontal: 10}}>to</Text>
                    <TextInput 
                        style={styles.dateInput} 
                        value={endDate} 
                        onChangeText={setEndDate} 
                        placeholder="YYYY-MM-DD" 
                        placeholderTextColor="#94a3b8"
                    />
                    <TouchableOpacity onPress={fetchData} style={styles.filterBtn}>
                        <Text style={styles.filterBtnText}>GET</Text>
                    </TouchableOpacity>
                </View>
            </View>

            
            {showDebug && (
                <View style={styles.debugPanel}>
                    <Text style={styles.debugTitle}>RAW TRACE (LAST 50 RECORDS)</Text>
                    <ScrollView style={{maxHeight: 200}}>
                        <Text style={styles.debugText}>{JSON.stringify(debugData, null, 2)}</Text>
                    </ScrollView>
                    <TouchableOpacity onPress={() => setShowDebug(false)} style={styles.closeDebug}><Text style={styles.closeDebugText}>CLOSE TRACE</Text></TouchableOpacity>
                </View>
            )}


            <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                    <View style={[styles.iconBox, {backgroundColor:'#ecfdf5'}]}><Ionicons name="bar-chart" size={20} color="#10b981" /></View>
                    <Text style={styles.statLabel}>TODAY REVENUE</Text>
                    <Text style={styles.statValue}>₹{stats.revenue?.toLocaleString() || 0}</Text>
                </View>
                <View style={styles.statCard}>
                    <View style={[styles.iconBox, {backgroundColor:'#eff6ff'}]}><Ionicons name="receipt" size={20} color="#3b82f6" /></View>
                    <Text style={styles.statLabel}>TICKETS SOLD</Text>
                    <Text style={styles.statValue}>{stats.total || 0}</Text>
                </View>
            </View>

            <View style={styles.tabBar}>
                <TouchableOpacity onPress={() => setViewMode('server')} style={[styles.tab, viewMode === 'server' && styles.activeTab]}>
                    <Text style={[styles.tabText, viewMode === 'server' && styles.activeTabText]}>SERVER VIEW</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setViewMode('local')} style={[styles.tab, viewMode === 'local' && styles.activeTab]}>
                    <Text style={[styles.tabText, viewMode === 'local' && styles.activeTabText]}>OFFLINE HISTORY</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setViewMode('sync')} style={[styles.tab, viewMode === 'sync' && styles.activeTab]}>
                    <Text style={[styles.tabText, viewMode === 'sync' && styles.activeTabText]}>OFFLINE BACKUP SYNC</Text>
                </TouchableOpacity>
            </View>

            {viewMode === 'server' && lostRecords.length > 0 && (
                <View style={styles.lostBanner}>
                    <Ionicons name="warning" size={16} color="#ef4444" />
                    <Text style={styles.lostText}>FOUND {lostRecords.length} POTENTIALLY LOST RECORDS (MISMATCHED POS)</Text>
                    <TouchableOpacity onPress={() => setTickets([...tickets, ...lostRecords])} style={styles.recoverBtn}>
                        <Text style={styles.recoverBtnText}>SHOW THEM</Text>
                    </TouchableOpacity>
                </View>
            )}



            {viewMode === 'sync' && (
                <View style={styles.syncBanner}>
                    <View style={{flex: 1}}>
                        <Text style={styles.syncTitle}>MANUAL SERVER SYNC</Text>
                        <Text style={styles.syncSub}>Find and upload missing offline records to the server.</Text>
                    </View>
                    <TouchableOpacity onPress={handleManualSync} style={styles.syncActionBtn} disabled={isSyncing}>
                        {isSyncing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.syncActionText}>CHECK & SYNC</Text>}
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color="#94a3b8" style={{marginLeft: 15}} />
                <TextInput style={styles.searchInput} placeholder="Search Transaction ID or Mobile..." value={searchTerm} onChangeText={setSearchTerm} />
            </View>

            <View style={styles.listHeader}>
                <Text style={styles.listTitle}>{viewMode === 'server' ? 'All Transactions' : 'Locally Saved Records'}</Text>
                <Text style={styles.listCount}>{viewMode === 'server' ? filteredTickets.length : filteredArchive.length} Found</Text>
            </View>

            <SectionList
                sections={getGroupedTickets(viewMode === 'server' ? filteredTickets : filteredArchive)}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listPadding}
                renderSectionHeader={({ section: { title, data, dailyTotal, upiTotal, cashTotal, failedTotal, cancelledCount } }) => (
                    <View style={styles.sectionHeaderBox}>
                        <Text style={styles.sectionHeaderText}>{title}</Text>
                        <View style={styles.sectionBadge}>
                            <Text style={styles.sectionBadgeText}>{data.length} Txn</Text>
                        </View>
                        {upiTotal > 0 && (
                            <View style={[styles.sectionBadge, { backgroundColor: '#3b82f6', marginLeft: 8 }]}>
                                <Text style={[styles.sectionBadgeText, { color: '#fff' }]}>UPI ₹{upiTotal.toLocaleString()}</Text>
                            </View>
                        )}
                        {cashTotal > 0 && (
                            <View style={[styles.sectionBadge, { backgroundColor: '#10b981', marginLeft: 8 }]}>
                                <Text style={[styles.sectionBadgeText, { color: '#fff' }]}>CASH ₹{cashTotal.toLocaleString()}</Text>
                            </View>
                        )}
                        {(upiTotal === 0 && cashTotal === 0 && dailyTotal > 0) && (
                            <View style={[styles.sectionBadge, { backgroundColor: '#10b981', marginLeft: 8 }]}>
                                <Text style={[styles.sectionBadgeText, { color: '#fff' }]}>₹{dailyTotal.toLocaleString()}</Text>
                            </View>
                        )}
                        {failedTotal > 0 && (
                            <View style={[styles.sectionBadge, { backgroundColor: '#ef4444', marginLeft: 8 }]}>
                                <Text style={[styles.sectionBadgeText, { color: '#fff' }]}>Failed ₹{failedTotal.toLocaleString()}</Text>
                            </View>
                        )}
                        {cancelledCount > 0 && (
                            <View style={[styles.sectionBadge, { backgroundColor: '#f59e0b', marginLeft: 8 }]}>
                                <Text style={[styles.sectionBadgeText, { color: '#fff' }]}>{cancelledCount} Cancelled</Text>
                            </View>
                        )}
                    </View>
                )}
                renderItem={({ item }) => {
                    const status = item.status || (viewMode === 'server' ? 'success' : 'unknown');
                    const statusColor = status === 'success' ? '#10b981' : status === 'failed' ? '#ef4444' : status === 'cancelled' ? '#f59e0b' : '#3b82f6';
                    
                    return (
                    <View style={[styles.ticketCard, { borderLeftColor: statusColor }]}>
                        <View style={styles.ticketMain}>
                            <View style={[styles.ticketBadge, { backgroundColor: `${statusColor}15` }]}>
                                <Ionicons 
                                    name={status === 'success' ? "cloud-done" : status === 'failed' ? "close-circle" : "time-outline"} 
                                    size={14} 
                                    color={statusColor} 
                                />
                            </View>
                            <View style={{flex: 1}}>
                                <View style={{flexDirection:'row', alignItems:'center'}}>
                                    <Text style={styles.ticketId}>{item.id}</Text>
                                    <View style={[styles.statusTag, {backgroundColor: statusColor}]}>
                                        <Text style={styles.statusTagText}>{status.toUpperCase()}</Text>
                                    </View>
                                </View>
                                <Text style={styles.ticketDetails}>
                                    {new Date(item.createdAt).toLocaleTimeString()} • {item.paymentMode ? item.paymentMode.toUpperCase() : 'UPI'}
                                    {viewMode !== 'server' && (item.synced ? ' • SYNCED' : ' • OFFLINE')}
                                </Text>
                            </View>
                            <View style={{alignItems:'flex-end'}}>
                                <Text style={styles.ticketAmount}>₹{item.amount}</Text>
                                {(status === 'success' || status === 'unknown' || viewMode === 'server') && status !== 'failed' && status !== 'cancelled' && (
                                    <TouchableOpacity style={styles.reprintBtn} onPress={() => handleReprint(item)} disabled={isPrinting}>
                                        <Ionicons name="print" size={12} color="#fff" />
                                        <Text style={styles.reprintText}>REPRINT</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                        {item.mobile && (
                            <View style={styles.ticketFooter}>
                                <Ionicons name="phone-portrait-outline" size={12} color="#64748b" />
                                <Text style={styles.mobileText}>{item.mobile}</Text>
                            </View>
                        )}
                    </View>
                )}}
            />

        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { backgroundColor: '#0f172a', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    brandRow: { flexDirection: 'row', alignItems: 'center' },
    backButton: { marginRight: 15 },
    headerTitle: { fontSize: 18, fontWeight: '900', color: '#fff' },
    headerSub: { fontSize: 8, color: '#64748b', fontWeight: 'bold', letterSpacing: 1 },
    btBadge: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
    refreshBtn: { marginLeft: 'auto', padding: 5 },
    headerActions: { flexDirection: 'row', alignItems: 'center' },
    actionBtn: { marginLeft: 15, padding: 5 },
    dateFilterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15 },
    dateInput: { backgroundColor: '#1e293b', color: '#fff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5, flex: 1, fontSize: 12 },
    filterBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 5, marginLeft: 10 },
    filterBtnText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    statsGrid: { padding: 15, flexDirection: 'row', justifyContent: 'space-between' },

    statCard: { backgroundColor: '#fff', width: (width - 40) / 2, padding: 15, borderRadius: 20, elevation: 2 },
    iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    statLabel: { fontSize: 8, fontWeight: 'bold', color: '#64748b', marginBottom: 4 },
    statValue: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 15, borderRadius: 15, height: 50, elevation: 1 },
    searchInput: { flex: 1, paddingHorizontal: 10, fontSize: 13, color: '#1e293b' },
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 20, marginBottom: 10 },
    listTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
    listCount: { fontSize: 10, color: '#64748b', fontWeight: 'bold' },
    listPadding: { paddingHorizontal: 15, paddingBottom: 50 },
    sectionHeaderBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e2e8f0', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 10, marginTop: 5 },
    sectionHeaderText: { fontSize: 10, fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', marginRight: 8 },
    sectionBadge: { backgroundColor: '#cbd5e1', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
    sectionBadgeText: { fontSize: 9, fontWeight: 'bold', color: '#0f172a' },
    ticketCard: { backgroundColor: '#fff', borderRadius: 18, padding: 15, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#3b82f6' },
    ticketMain: { flexDirection: 'row', alignItems: 'center' },
    ticketBadge: { width: 30, height: 30, backgroundColor: '#eff6ff', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    ticketId: { fontSize: 11, fontWeight: 'bold', color: '#1e293b' },
    ticketDetails: { fontSize: 9, color: '#64748b', marginTop: 2 },
    ticketAmount: { fontSize: 14, fontWeight: '900', color: '#00cc99' },
    reprintBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 5 },
    reprintText: { color: '#fff', fontSize: 8, fontWeight: 'bold', marginLeft: 4 },
    ticketFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    statusTag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, marginLeft: 8 },
    statusTagText: { color: '#fff', fontSize: 7, fontWeight: 'bold' },
    mobileText: { fontSize: 10, fontWeight: 'bold', color: '#64748b', marginLeft: 5 },
    debugPanel: { backgroundColor: '#1e293b', padding: 15, margin: 10, borderRadius: 10 },
    debugTitle: { color: '#f0c05a', fontSize: 10, fontWeight: 'bold', marginBottom: 5 },
    debugText: { color: '#94a3b8', fontSize: 8, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
    closeDebug: { marginTop: 10, alignItems: 'center', padding: 5, backgroundColor: '#334155', borderRadius: 5 },
    closeDebugText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    lostBanner: { backgroundColor: '#fee2e2', marginHorizontal: 15, padding: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#fecaca' },
    lostText: { flex: 1, fontSize: 9, color: '#991b1b', fontWeight: 'bold', marginLeft: 8 },
    recoverBtn: { backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
    recoverBtnText: { color: '#fff', fontSize: 8, fontWeight: 'bold' },
    tabBar: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 15, borderRadius: 12, marginTop: 15, padding: 4 },
    tab: { flex: 1, paddingVertical: 10, paddingHorizontal: 2, alignItems: 'center', borderRadius: 8 },
    activeTab: { backgroundColor: '#0f172a' },
    tabText: { fontSize: 8, fontWeight: 'bold', color: '#64748b', textAlign: 'center' },
    activeTabText: { color: '#fff' },
    syncBanner: { backgroundColor: '#e0f2fe', marginHorizontal: 15, padding: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#bae6fd' },
    syncTitle: { fontSize: 11, fontWeight: 'bold', color: '#0369a1' },
    syncSub: { fontSize: 9, color: '#0ea5e9', marginTop: 2 },
    syncActionBtn: { backgroundColor: '#0284c7', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    syncActionText: { color: '#fff', fontSize: 9, fontWeight: 'bold' }
});



