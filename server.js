const express = require('express');
const app = express();
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const fingerprint = require('express-fingerprint');

// Enable CORS
app.use(cors());

// Load environment variables from .env file
dotenv.config();

const PORT = process.env.PORT || 3000;
const URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mydatabase';

// Middleware to parse JSON requests
app.use(express.json());

// Middleware to generate browser fingerprint
app.use(fingerprint({
    parameters: [
        // Customize parameters as needed
        fingerprint.useragent,
        fingerprint.acceptHeaders,
        fingerprint.geoip,
    ]
}));

// Connect mongoose to MongoDB
mongoose
    .connect(URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('MongoDB connected');

        // Define a schema for the total page views
        const totalPageViewsSchema = new mongoose.Schema({
            count: { type: Number, default: 0 }
        });

        // Create a model for the total page views
        const TotalPageViews = mongoose.model('TotalPageViews', totalPageViewsSchema);

        // Define a schema for the unique user page views
        const uniqueUserPageViewsSchema = new mongoose.Schema({
            fingerprint: { type: String, unique: true },
            count: { type: Number, default: 0 }
        });

        // Create a model for the unique user page views
        const UniqueUserPageViews = mongoose.model('UniqueUserPageViews', uniqueUserPageViewsSchema);

        // Middleware to increment total page view count and unique user page view count
        app.use(async (req, res, next) => {
            try {
                const fingerprint = req.fingerprint.hash;

                // Find the record for the unique user page views
                let uniqueUserPageViews = await UniqueUserPageViews.findOne({ fingerprint });

                if (!uniqueUserPageViews) {
                    // If fingerprint is unique, create a new record
                    uniqueUserPageViews = new UniqueUserPageViews({ fingerprint, count: 1 });
                    await uniqueUserPageViews.save();

                    // Increment total page view count
                    let totalPageViews = await TotalPageViews.findOne();
                    if (!totalPageViews) {
                        totalPageViews = new TotalPageViews({ count: 1 }); // Initialize count to 1
                    } else {
                        totalPageViews.count++; // Increment count
                    }
                    await totalPageViews.save();
                }

                // Retrieve updated total page view count
                const totalPageViews = await TotalPageViews.findOne();
                
                // Pass the total page view count and unique user page view count to the next middleware
                req.totalPageViews = totalPageViews ? totalPageViews.count : 0; // Set total page views to 0 if not found
                req.uniqueUserPageViews = uniqueUserPageViews.count;
                next();
            } catch (error) {
                console.error('Error incrementing page view count:', error);
                next(error);
            }
        });

        // Route to get the total page view count via API
        app.get('/api/totalpageviews', async (req, res) => {
            try {
                // Respond with the total page view count
                res.json({ totalPageViews: req.totalPageViews });
            } catch (error) {
                console.error('Error fetching total page view count:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // Route to get the unique user page view count via API
        app.get('/api/uniqueuserpageviews', async (req, res) => {
            try {
                // Respond with the unique user page view count
                res.json({ uniqueUserPageViews: req.uniqueUserPageViews });
            } catch (error) {
                console.error('Error fetching unique user page view count:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // Start the server
        app.listen(PORT, () => {
            console.log('Server running on port', PORT);
        });

    })
    .catch((error) => {
        console.error('MongoDB connection failed:', error.message);
    });
