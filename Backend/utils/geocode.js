// Backend/utils/geocode.js
const axios = require('axios');

const getCoordinatesFromCity = async (city) => {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`;
    const response = await axios.get(url);

    if (!response.data || response.data.length === 0) {
      throw new Error('City not found');
    }

    const { lon, lat } = response.data[0];
    return [parseFloat(lon), parseFloat(lat)];
  } catch (error) {
    console.error('Geocoding Error:', error.message);
    throw error;
  }
};

module.exports = { getCoordinatesFromCity };
