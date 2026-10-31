import React, { useState, useEffect } from 'react';
import { Image, StyleSheet } from 'react-native';
import { API_URL } from '../api/config';

export const FALLBACK_IMAGE = require('../../assets/public/logo.jpeg');

// Map of local bundled ride assets
export const LOCAL_RIDE_IMAGES = {
  // By exact filename from API
  '2d theatre.webp': require('../../assets/rides/2D THEATRE.webp'),
  '360 ride.avif': require('../../assets/rides/360 ride.avif'),
  'air-hockey.png': require('../../assets/rides/air-hockey.png'),
  'basket ball.webp': require('../../assets/rides/BASKET BALL.webp'),
  'battery car ride.jpg': require('../../assets/rides/battery car ride.jpg'),
  'bouncy.webp': require('../../assets/rides/BOUNCY.webp'),
  'break-dance-ride-.webp': require('../../assets/rides/break-dance-ride-.webp'),
  'bull ride.webp': require('../../assets/rides/bull ride.webp'),
  'bumping cars double.webp': require('../../assets/rides/bUMPING CARS double.webp'),
  'bumping cars single.webp': require('../../assets/rides/bUMPING CARS single.webp'),
  'cricket.png': require('../../assets/rides/cricket.png'),
  'e three bus ride.webp': require('../../assets/rides/e three bus ride.webp'),
  'gun shoot.webp': require('../../assets/rides/GUN SHOOT.webp'),
  'logo.jpeg': require('../../assets/rides/logo.jpeg'),
  'logo(1).jpeg': require('../../assets/rides/logo.jpeg'),
  'm. columbus.png': require('../../assets/rides/M. COLUMBUS.png'),
  'massage-chair.png': require('../../assets/rides/massage-chair.png'),
  'melt down.webp': require('../../assets/rides/melt down.webp'),
  'redem-liongames.png': require('../../assets/rides/redem-liongames.png'),
  'rocket ejector.jpg': require('../../assets/rides/ROCKET EJECTOR.jpg'),
  'rope course.jpg': require('../../assets/rides/ROPE COURSE.jpg'),
  'samba balloon.jpg': require('../../assets/rides/SAMBA BALLOON.jpg'),
  'softplay.png': require('../../assets/rides/softplay.png'),
  'sun @ moon ride.webp': require('../../assets/rides/SUN @ MOON ride.webp'),
  'surfer ride.jpg': require('../../assets/rides/SURFER RIDE.jpg'),
  'tl train.jpg': require('../../assets/rides/TL train.jpg'),
  'trampoline.avif': require('../../assets/rides/TRAMPOLINE.avif'),
  'vr-game.png': require('../../assets/rides/vr-game.png'),
  'zip bike.jpg': require('../../assets/rides/ZIP BIKE.jpg'),
  'free-ride-ticket.png': require('../../assets/rides/free-ride-ticket.png'),

  // By ride name alias
  'tl train': require('../../assets/rides/TL train.jpg'),
  'train': require('../../assets/rides/TL train.jpg'),
  'ethree bus': require('../../assets/rides/e three bus ride.webp'),
  'bus': require('../../assets/rides/e three bus ride.webp'),
  'sun moon': require('../../assets/rides/SUN @ MOON ride.webp'),
  'sun @ moon': require('../../assets/rides/SUN @ MOON ride.webp'),
  'rope course': require('../../assets/rides/ROPE COURSE.jpg'),
  '2d theatre': require('../../assets/rides/2D THEATRE.webp'),
  'cricket (3 overs)': require('../../assets/rides/cricket.png'),
  'cricket (5 overs)': require('../../assets/rides/cricket.png'),
  'cricket': require('../../assets/rides/cricket.png'),
  'air hockey (1 game)': require('../../assets/rides/air-hockey.png'),
  'air hockey (best of 3)': require('../../assets/rides/air-hockey.png'),
  'air hockey': require('../../assets/rides/air-hockey.png'),
  'battery car': require('../../assets/rides/battery car ride.jpg'),
  'redem liongames': require('../../assets/rides/redem-liongames.png'),
  '360 ride': require('../../assets/rides/360 ride.avif'),
  'basket ball': require('../../assets/rides/BASKET BALL.webp'),
  'basketball': require('../../assets/rides/BASKET BALL.webp'),
  'surfer ride': require('../../assets/rides/SURFER RIDE.jpg'),
  'combo child': require('../../assets/rides/logo.jpeg'),
  'combo adult': require('../../assets/rides/logo.jpeg'),
  'combo': require('../../assets/rides/logo.jpeg'),
  'softplay (20 mins)': require('../../assets/rides/softplay.png'),
  'softplay': require('../../assets/rides/softplay.png'),
  'm columbus': require('../../assets/rides/M. COLUMBUS.png'),
  'm. columbus': require('../../assets/rides/M. COLUMBUS.png'),
  'columbus': require('../../assets/rides/M. COLUMBUS.png'),
  'bull ride': require('../../assets/rides/bull ride.webp'),
  'bouncy': require('../../assets/rides/BOUNCY.webp'),
  'gun shoot': require('../../assets/rides/GUN SHOOT.webp'),
  'rocket ejector': require('../../assets/rides/ROCKET EJECTOR.jpg'),
  'melt down': require('../../assets/rides/melt down.webp'),
  'bumping cars': require('../../assets/rides/bUMPING CARS single.webp'),
  'bumping cars single': require('../../assets/rides/bUMPING CARS single.webp'),
  'bumping cars (high)': require('../../assets/rides/bUMPING CARS double.webp'),
  'bumping cars double': require('../../assets/rides/bUMPING CARS double.webp'),
  'trampoline': require('../../assets/rides/TRAMPOLINE.avif'),
  'samba balloon': require('../../assets/rides/SAMBA BALLOON.jpg'),
  'balloon shooting': require('../../assets/rides/SAMBA BALLOON.jpg'),
  'break dance': require('../../assets/rides/break-dance-ride-.webp'),
  'vr game': require('../../assets/rides/vr-game.png'),
  'massage chair': require('../../assets/rides/massage-chair.png'),
  'zip bike': require('../../assets/rides/ZIP BIKE.jpg'),
  'free ride ticket': require('../../assets/rides/free-ride-ticket.png'),
  'free ride': require('../../assets/rides/free-ride-ticket.png'),
};

export const RIDE_DESCRIPTIONS = {
  'TL TRAIN': 'A classic train ride perfect for families and children. Enjoy a scenic tour around the park in our comfortable and safe trackless train.',
  'ETHREE BUS': 'Hop on the ETHREE Shuttle Bus for a fun and easy way to navigate the park. A favorite for kids who love big vehicles!',
  'SUN @ MOON': 'A gentle and charming rotary ride that takes you on a celestial journey. Beautifully designed for our younger guests.',
  'BOUNCY': 'High-energy inflatable fun! Our giant bouncy castle provides a safe and exciting environment for children to jump and play.',
  'SAMBA BALLOON': 'Soar high in colorful hot air balloons that spin and tilt. A vibrant and rhythmic ride that brings the carnival atmosphere to life.',
  'M. COLUMBUS': 'Experience the thrill of the high seas on this swinging pirate ship. A classic adventure that provides a stomach-flipping sensation for all ages.',
  'BUMPING CARS': 'Classic dabbing and driving fun! Safe, electric-powered cars for children and teens to enjoy some friendly competition.',
  'ZIP BIKE': 'Cycle through the air! This unique aerial ride lets you pedal your way along a high-wire track for an amazing view of the park.',
  'ROPE COURSE': 'Test your balance and agility on our premium adventure rope course. Features multiple levels of obstacles for the ultimate physical challenge.',
  'GUN SHOOT': 'Test your aim and steady hand in our professional shooting gallery. High-quality air rifles and various targets for a competitive experience.',
  'BASKET BALL': 'Show off your hoops skills! Our arcade-style basketball challenge is perfect for quick games and high-score competitions.',
  '2D THEATRE': 'Enjoy immersive cinematic experiences in our premium 2D theatre. Features high-quality sound and visuals for a relaxing break.',
  'ROCKET EJECTOR': 'Blast off! Experience intense G-forces as you are launched skyward in this adrenaline-pumping catapult ride.',
  'SURFER RIDE': 'Catch the wave on this high-speed spinning platform. Simulates the sensation of surfing with dynamic movements and music.',
  'TRAMPOLINE': 'Premium jumping area for all skill levels. Our high-performance trampolines are built for maximum bounce and safety.',
  'BATTERY CAR': 'Miniature luxury cars for the little ones! Safe, slow-speed electric vehicles that give kids their first taste of driving.',
  'MELT DOWN': 'Duck and jump! A competitive mechanical sweeper game where you must avoid the rotating arms to be the last one standing.',
  '360 RIDE': 'Defy gravity! This intense ride rotates you a full 360 degrees for an exhilarating and disorienting thrill experience.',
  'REDEM LIONGAMES': 'Premium arcade redemption machine. Play games, win tickets, and claim amazing prizes at our redemption center.',
  'BULL RIDE': 'Hold on tight! Test your strength against our mechanical bull with computer-controlled movements for a wild ride.',
  'BREAK DANCE': 'High-speed spinning and tilting action with vibrant lights and modern music. A must-try for thrill-seekers.',
  'BUMPING CARS (HIGH)': 'Adult-sized bumping car action! Faster cars and more space for those looking for a higher-intensity driving experience.',
  'CRICKET (3 OVERS)': 'High-tech cricket simulator with professional bowling machine. Play 3 overs of realistic cricket in a safe indoor net.',
  'CRICKET (5 OVERS)': 'The full cricket experience! 5 overs of intense batting practice against our high-speed bowling machine.',
  'VR GAME': 'Enter new worlds with our premium VR gaming setup. Features high-end headsets and motion-tracking for ultimate immersion.',
  'AIR HOCKEY (1 GAME)': 'Classic fast-paced arcade fun! Challenge a friend to a high-speed game of air hockey on our professional tables.',
  'AIR HOCKEY (BEST OF 3)': 'The ultimate air hockey showdown. Play a full tournament series with your friends to see who is the true champion.',
  'MASSAGE CHAIR': 'Relax and rejuvenate in our luxury zero-gravity massage chairs. Features advanced massage techniques for full body relief.',
  'SOFTPLAY (20 MINS)': 'A safe and vibrant indoor play area for young children. Features soft foam structures, slides, and ball pits.',
  'COMBO CHILD': 'The ultimate entertainment value pack! Includes access to multiple top-rated rides and attractions for a complete ETHREE experience.',
  'COMBO ADULT': 'Standard adult combo package for the complete ETHREE park experience.',
  'BALLOON SHOOTING': 'Test your precision and popping skills with fun balloon targets!',
};

const normalizeKey = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().trim();
};

/**
 * Returns the best image source object or require reference for a ride item.
 */
export const getRideImageSource = (item) => {
  if (!item) return FALLBACK_IMAGE;

  // 1. Direct Web URL (e.g. S3, Cloudinary, Imgur, or custom CDN)
  if (typeof item.image === 'string' && (item.image.startsWith('http://') || item.image.startsWith('https://'))) {
    return {
      uri: item.image,
      headers: {
        'ngrok-skip-browser-warning': 'true',
        Accept: 'image/*',
      },
    };
  }

  // 2. Check local bundled assets by image filename
  if (item.image) {
    const filenameKey = normalizeKey(item.image);
    if (LOCAL_RIDE_IMAGES[filenameKey]) {
      return LOCAL_RIDE_IMAGES[filenameKey];
    }
  }

  // 3. Check local bundled assets by ride name
  if (item.name) {
    const nameKey = normalizeKey(item.name);
    if (LOCAL_RIDE_IMAGES[nameKey]) {
      return LOCAL_RIDE_IMAGES[nameKey];
    }

    // Fuzzy matching
    const strippedKey = nameKey.replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    for (const key of Object.keys(LOCAL_RIDE_IMAGES)) {
      const strippedLocal = key.replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
      if (strippedKey.length > 2 && (strippedKey === strippedLocal || strippedKey.includes(strippedLocal) || strippedLocal.includes(strippedKey))) {
        return LOCAL_RIDE_IMAGES[key];
      }
    }
  }

  // 4. Remote backend attempt (if the server ever serves /images)
  if (item.image) {
    return {
      uri: `${API_URL}/images/${encodeURIComponent(item.image)}?ngrok-skip-browser-warning=true`,
      headers: {
        'ngrok-skip-browser-warning': 'true',
        Accept: 'image/*',
      },
    };
  }

  return FALLBACK_IMAGE;
};

/**
 * Returns a human-friendly description for the ride
 */
export const getRideDescription = (item) => {
  if (!item) return 'Enjoy this exciting ETHREE attraction.';
  if (item.description && item.description.trim() && item.description !== 'No description available.') {
    return item.description;
  }
  if (item.desc && item.desc.trim()) {
    return item.desc;
  }
  const nameUpper = (item.name || '').toUpperCase().trim();
  if (RIDE_DESCRIPTIONS[nameUpper]) {
    return RIDE_DESCRIPTIONS[nameUpper];
  }
  // Try partial name match
  for (const [key, desc] of Object.entries(RIDE_DESCRIPTIONS)) {
    if (nameUpper.includes(key) || key.includes(nameUpper)) {
      return desc;
    }
  }
  return 'Experience the thrill and excitement of this premium ETHREE attraction!';
};

/**
 * Robust Ride Image Component that auto-swaps on error
 */
export function RideCardImage({ item, style }) {
  const initialSource = getRideImageSource(item);
  const [source, setSource] = useState(initialSource);

  useEffect(() => {
    setSource(getRideImageSource(item));
  }, [item?.image, item?.name]);

  return (
    <Image
      source={source}
      style={style}
      resizeMode="cover"
      defaultSource={FALLBACK_IMAGE}
      onError={() => {
        if (source !== FALLBACK_IMAGE) {
          // If network or initial source failed, fall back to default
          setSource(FALLBACK_IMAGE);
        }
      }}
    />
  );
}
