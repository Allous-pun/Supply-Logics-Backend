// src/utils/geocoding.js

// OpenStreetMap Nominatim geocoding (free, no API key)
const geocodeAddress = async (address, city, region, country = 'Kenya') => {
  try {
    // Build the search query
    let searchQuery = '';
    if (address) searchQuery += `${address}, `;
    if (city) searchQuery += `${city}, `;
    if (region) searchQuery += `${region}, `;
    searchQuery += country;
    
    // Encode the query for URL
    const encodedQuery = encodeURIComponent(searchQuery);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=1`;
    
    // Make request with proper headers (required by Nominatim)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BizStack-Flow/1.0',
        'Accept-Language': 'en'
      }
    });
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        formattedAddress: data[0].display_name
      };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

// Calculate driving distance between two coordinates using OSRM
const calculateDrivingDistance = async (lat1, lon1, lat2, lon2) => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      return {
        distanceKm: data.routes[0].distance / 1000, // meters to km
        durationMin: data.routes[0].duration / 60, // seconds to minutes
        geometry: data.routes[0].geometry // optional: route path
      };
    }
    return null;
  } catch (error) {
    console.error('OSRM distance calculation error:', error);
    return null;
  }
};

module.exports = {
  geocodeAddress,
  calculateDrivingDistance
};