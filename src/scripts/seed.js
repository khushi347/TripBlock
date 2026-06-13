const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Farmer = require('../models/Farmer');
const Provider = require('../models/Provider');
const ServiceRequest = require('../models/ServiceRequest');
const TripBlock = require('../models/TripBlock');
const Assignment = require('../models/Assignment');
const Analytics = require('../models/Analytics');

dotenv.config();

const seedData = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/tripblock');
    console.log('Connected to DB for seeding...');

    // Clear existing data
    await Farmer.deleteMany({});
    await Provider.deleteMany({});
    await ServiceRequest.deleteMany({});
    await TripBlock.deleteMany({});
    await Assignment.deleteMany({});
    await Analytics.deleteMany({});
    console.log('Cleared existing database records.');

    // Seed Farmers
    const farmers = await Farmer.create([
      {
        name: 'Ramesh Kumar',
        phone: '9876543210',
        email: 'ramesh@gmail.com',
        password: 'password123',
        location: { type: 'Point', coordinates: [77.4126, 23.2599] } // Bhopal Center
      },
      {
        name: 'Suresh Patel',
        phone: '9876543211',
        email: 'suresh@gmail.com',
        password: 'password123',
        location: { type: 'Point', coordinates: [77.4200, 23.2650] } // ~1.05 KM away
      },
      {
        name: 'Mahesh Singh',
        phone: '9876543212',
        email: 'mahesh@gmail.com',
        password: 'password123',
        location: { type: 'Point', coordinates: [77.4350, 23.2800] } // ~3.2 KM away
      },
      {
        name: 'Far Away Farmer',
        phone: '9876543213',
        email: 'farfarmer@gmail.com',
        password: 'password123',
        location: { type: 'Point', coordinates: [78.5000, 24.5000] } // >100 KM away
      }
    ]);
    console.log(`Successfully seeded ${farmers.length} Farmers.`);

    // Seed Providers
    const providers = await Provider.create([
      {
        name: 'Bhopal Water Logistics',
        phone: '9988776650',
        email: 'bhopalwater@gmail.com',
        password: 'password123',
        serviceType: 'water_tanker',
        location: { type: 'Point', coordinates: [77.4100, 23.2550] }, // Centroid proximity
        capacity: 10000,
        availability: true,
        rating: 4.8,
        completionRate: 0.98,
        costPerTrip: 250,
        status: 'active'
      },
      {
        name: 'Express Water Services',
        phone: '9988776651',
        email: 'expresswater@gmail.com',
        password: 'password123',
        serviceType: 'water_tanker',
        location: { type: 'Point', coordinates: [77.4500, 23.2900] }, // Further away (~6km)
        capacity: 8000,
        availability: true,
        rating: 4.2,
        completionRate: 0.90,
        costPerTrip: 300,
        status: 'active'
      },
      {
        name: 'Raja Tractor Dispatches',
        phone: '9988776652',
        email: 'rajatractors@gmail.com',
        password: 'password123',
        serviceType: 'tractor',
        location: { type: 'Point', coordinates: [77.4120, 23.2600] },
        capacity: 5,
        availability: true,
        rating: 4.9,
        completionRate: 0.99,
        costPerTrip: 150,
        status: 'active'
      }
    ]);
    console.log(`Successfully seeded ${providers.length} Providers.`);

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
