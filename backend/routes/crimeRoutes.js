// Setup code
const express = require('express');
const axios = require('axios');
const router = express.Router();

// Add crime report to database
router.post('/add', (req, res) => {
    const db = req.app.locals.db;
    const { latitude, longitude, category } = req.body;

    db.run(`INSERT INTO crimes (latitude, longitude, category, date) VALUES (?, ?, ?, ?)`, [latitude, longitude, category, new Date().toISOString()], function (err) {
        if (err) {
            console.error('Error adding crime report:', err.message);
            res.status(500).json({ error: 'Could not add crime report' });
        } else {
            res.status(201).json({ message: 'Crime report added successfully', id: this.lastID });
        }
    });
});

// Retrieve all crime reports
router.get('/fetch', (req, res) => {
    const db = req.app.locals.db;

    db.all(`SELECT * FROM crimes`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching crime reports:', err.message);
            res.status(500).json({ error: 'Could not fetch crime reports' });
        } else {
            res.json(rows);
        }
    });
});

// Compute the safest route
router.get('/safe-route', async (req, res) => {
    const db = req.app.locals.db;
    try {
        const { origin, destination } = req.query;

        if (!origin || !destination) {
            return res.status(400).json({ error: 'Origin and destination are required' });
        }

        // Geocode origin and destination
        const geocode = async (address) => {
            const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
                params: { address, key: process.env.GOOGLE_MAPS_API_KEY }
            });
            if (response.data.results.length === 0) {
                throw new Error('Address not found');
            }
            return response.data.results[0].geometry.location;
        };

        const originCoords = origin.includes(',') 
            ? { lat: parseFloat(origin.split(',')[0]), lng: parseFloat(origin.split(',')[1]) } 
            : await geocode(origin);

        const destinationCoords = destination.includes(',') 
            ? { lat: parseFloat(destination.split(',')[0]), lng: parseFloat(destination.split(',')[1]) } 
            : await geocode(destination);

        // Fetch routes from Google Directions API
        const directionsResponse = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
            params: {
                origin: `${originCoords.lat},${originCoords.lng}`,
                destination: `${destinationCoords.lat},${destinationCoords.lng}`,
                key: process.env.GOOGLE_MAPS_API_KEY
            }
        });

        const routes = directionsResponse.data.routes;
        if (!routes.length) return res.status(404).json({ error: 'No routes found' });

        let safestRoute = null;
        let minCrimeCount = Infinity;

        // Fetch all crimes from the database
        const crimes = await new Promise((resolve, reject) => {
            db.all(`SELECT * FROM crimes`, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Analyze routes for crime proximity
        routes.forEach((route) => {
            let crimeCount = 0;

            route.legs.forEach((leg) => {
                leg.steps.forEach((step) => {
                    const { start_location, end_location } = step;

                    crimes.forEach((crime) => {
                        const crimeDistanceStart = getDistance(crime.latitude, crime.longitude, start_location.lat, start_location.lng);
                        const crimeDistanceEnd = getDistance(crime.latitude, crime.longitude, end_location.lat, end_location.lng);

                        if (crimeDistanceStart < 0.5 || crimeDistanceEnd < 0.5) {
                            crimeCount++;
                        }
                    });
                });
            });

            if (crimeCount < minCrimeCount) {
                minCrimeCount = crimeCount;
                safestRoute = route;
            }
        });

        res.json({ safestRoute, crimeCount: minCrimeCount });
    } catch (error) {
        console.error('Error computing safe route:', error.message);
        res.status(500).json({ error: 'Failed to compute safe route' });
    }
});

// Calculate distance between two coordinates
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

module.exports = router;