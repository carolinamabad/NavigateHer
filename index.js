// Importing everything I'll need for my code to run
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');
const cors = require('cors');
// Routing
const crimeRoutes = require('./routes/crimeRoutes.js');

// Environment variables
dotenv.config();

const app = express();
// Specifying port for site
const PORT = process.env.PORT || 5001;

app.use(express.json());
app.use(cors());

// Initialize SQLite 
const dbPath = './data/database.sqlite';
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');

        // Create crimes table
        db.run(`CREATE TABLE IF NOT EXISTS crimes (
            id INTEGER PRIMARY KEY AUTOINCREMENT, latitude REAL, longitude REAL, category TEXT, date TEXT)`, (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            } else {
                console.log('Crimes table ready');
            }
        });
    }
});

// Set database instance in app locals for use in routes
app.locals.db = db;

// Further set up routes - Crime
app.use('/api/crimes', crimeRoutes);

// Starting the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});