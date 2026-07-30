/**
 * Final Production Ticket Formatter - Exact Replica of User's Image.
 */

export const formatTicket = (ride, ticketId, mobile, user, paymentMode = 'UPI') => {
    const date = new Date();
    
    // Safer Date formatting to avoid Unicode glitches (weird chars) on thermal printers
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
    const dateFormat = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}, ${timeStr}`;
    
    const separator = '--------------------------------'; 
    
    // ESC/POS Commands
    const ESC = '\x1b';
    const GS = '\x1d';
    const CENTER = `${ESC}\x61\x01`;
    const LEFT = `${ESC}\x61\x00`;
    
    // Sizing Commands
    const NORMAL = `${GS}\x21\x00`;
    const DOUBLE = `${GS}\x21\x11`; // 2x width and height
    const QUAD = `${GS}\x21\x33`;   // 4x width and height
    const GIGANTIC = `${GS}\x21\x55`; // 6x width and height
    
    // Emphasized (Bold) Commands
    const BOLD_ON = `${ESC}\x45\x01`;
    const BOLD_OFF = `${ESC}\x45\x00`;
    
    // Double Strike Command for Maximum Boldness
    const DOUBLE_STRIKE_ON = `${ESC}\x47\x01`;
    const DOUBLE_STRIKE_OFF = `${ESC}\x47\x00`;

    let ticket = '';
    
    // Initialize printer state
    ticket += LEFT + NORMAL + BOLD_OFF + DOUBLE_STRIKE_OFF;
    
    // 1. PAYMENT MODE (Top, Centered, Huge)
    ticket += `${BOLD_ON}${DOUBLE_STRIKE_ON}${GIGANTIC}${CENTER}${paymentMode}${BOLD_OFF}${DOUBLE_STRIKE_OFF}\n`;
    ticket += `${NORMAL}${CENTER}${separator}\n`;
    
    // 2. TOTAL PAYABLE (Left: Label, Right: Amount Huge)
    const totalLabel = "TOTALPAYABLE:";
    const priceStr = ride.price.toString();
    const paddingTotal = Math.max(0, 32 - totalLabel.length - (priceStr.length * 4));
    ticket += `${BOLD_ON}${DOUBLE_STRIKE_ON}${NORMAL}${LEFT}${totalLabel}${" ".repeat(paddingTotal)}${QUAD}${priceStr}\n`;
    ticket += `${NORMAL}${BOLD_OFF}${DOUBLE_STRIKE_OFF}${LEFT}${separator}\n`;
    
    // 3. RIDE INFO (Left)
    const rideName = ride.name.toUpperCase().substring(0, 15);
    ticket += `${BOLD_ON}${DOUBLE_STRIKE_ON}${DOUBLE}${LEFT}${rideName}${BOLD_OFF}${DOUBLE_STRIKE_OFF}\n`;
    
    const qtyText = "x 1";
    const priceLabel = "Price : INR";
    const paddingQty = Math.max(0, 32 - priceLabel.length - (qtyText.length * 2));
    ticket += `${NORMAL}${LEFT}${priceLabel}${" ".repeat(paddingQty)}${DOUBLE}${qtyText}\n`;
    ticket += `${NORMAL}${LEFT}${separator}\n`;
    
    // 4. ID & DATE
    ticket += `${NORMAL}${LEFT}`;
    ticket += `${BOLD_ON}ID:${BOLD_OFF} ${ticketId}\n`;
    ticket += `${BOLD_ON}DATE:${BOLD_OFF} ${dateFormat}\n`;
    ticket += `${separator}\n`;
    
    // 5. FOOTER (ETHREE Logo + Tagline + Contact)
    ticket += `${BOLD_ON}${DOUBLE_STRIKE_ON}${QUAD}${CENTER}ETHREE\n`;
    ticket += `${NORMAL}${CENTER}Eat. Enjoy .Entertain${BOLD_OFF}${DOUBLE_STRIKE_OFF}\n`;
    ticket += `${BOLD_ON}${CENTER}WWW.ETHREE.IN\n`;
    ticket += `${BOLD_ON}${CENTER}Support : +91 70369 23456\n`;
    ticket += `${BOLD_ON}${CENTER}Thank You! Visit Again\n`;
    
    // Feed extra blank lines to push the receipt past the cutter edge
    ticket += '\n\n\n\n\n';
    
    // Reset printer state at the end
    ticket += NORMAL + BOLD_OFF + DOUBLE_STRIKE_OFF + LEFT;
    
    return { 
        text: ticket, 
        id: ticketId,
        amount: ride.price,     // Match AdminDashboard requirement
        price: ride.price, 
        rideName: ride.name,
        paymentMode: paymentMode,
        mobile: mobile,
        posId: 'pos1',          // Match AdminDashboard filter
        createdAt: new Date().toISOString(),
        status: 'success'
    };
};

export const generateTicketsForCart = (cart, masterId, mobile, user, paymentMode) => {
    if (!cart || cart.length === 0) return [];
    
    const list = [];
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // 1. Create Master Record (This is what Admin Dashboard shows)
    const masterTicket = {
        id: masterId,
        amount: totalAmount,
        items: cart, // Needed for reprinting logic in AdminDashboard
        mobile: mobile,
        paymentMode: paymentMode,
        posId: 'pos1',
        createdAt: new Date().toISOString(),
        isMaster: true,
        createdBy: user?.name || 'POS',
        status: 'success'
    };
    list.push(masterTicket);

    // 2. Create Individual Sub-Tickets (These are for scanning/printing)
    cart.forEach((item) => {
        const quantity = item.quantity || 1;
        for (let i = 0; i < quantity; i++) {
            const subId = `${masterId}-R${list.length}`; // R1, R2...
            const ticket = formatTicket(item, subId, mobile, user, paymentMode);
            ticket.parentId = masterId; // Link to master
            list.push(ticket);
        }
    });
    
    return list;
};

