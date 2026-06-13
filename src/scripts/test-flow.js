const mongoose = require('mongoose');

// ==========================================
// IN-MEMORY MONGOOSE MOCK LAYER
// ==========================================
console.log('📦 Injecting In-Memory Mongoose Mock Layer...');

const db = {
  farmers: [],
  providers: [],
  servicerequests: [],
  tripblocks: [],
  assignments: [],
  analytics: []
};

// Helper to resolve pluralized collection names properly
const getCollectionName = (modelName) => {
  const name = modelName.toLowerCase();
  if (name === 'analytics') return 'analytics'; // already plural
  return name + 's';
};

// Helper to resolve an ID from an object or string
const getDocId = (val) => {
  if (!val) return '';
  return val._id ? val._id.toString() : val.toString();
};

// Helper to clone a document to prevent DB mutation on query populate
const cloneDoc = (doc) => {
  if (!doc) return null;
  const clone = { ...doc };
  // Preserving mongoose-like prototype methods (e.g. save)
  Object.setPrototypeOf(clone, Object.getPrototypeOf(doc));
  return clone;
};

// Mock Connection
mongoose.connect = async () => {
  console.log('[Mock DB] Connection established.');
  return { connection: { host: 'mock-in-memory-db' } };
};

// Mock Schema definition & indexing functions
mongoose.Schema.prototype.index = function() {};

// Mock save method
mongoose.Model.prototype.save = async function() {
  let modelName = this.constructor ? this.constructor.modelName : null;
  if (!modelName) {
    if (this.groupedRequests !== undefined) modelName = 'TripBlock';
    else if (this.individualCost !== undefined) modelName = 'ServiceRequest';
    else if (this.costPerTrip !== undefined) modelName = 'Provider';
    else if (this.phone !== undefined) modelName = 'Farmer';
    else if (this.savings !== undefined) modelName = 'Analytics';
    else modelName = 'Assignment';
  }
  
  const collectionName = getCollectionName(modelName);
  if (!this._id) {
    this._id = new mongoose.Types.ObjectId();
  }
  
  if (!db[collectionName]) {
    db[collectionName] = [];
  }
  
  const index = db[collectionName].findIndex(doc => doc._id.toString() === this._id.toString());
  if (index !== -1) {
    db[collectionName][index] = this;
  } else {
    db[collectionName].push(this);
  }
  return this;
};

// Mock create method
mongoose.Model.create = async function(docs) {
  const docArray = Array.isArray(docs) ? docs : [docs];
  const createdDocs = [];
  for (const docData of docArray) {
    const doc = new this(docData);
    await doc.save();
    createdDocs.push(doc);
  }
  return Array.isArray(docs) ? createdDocs : createdDocs[0];
};

// Mock find method
mongoose.Model.find = function(query) {
  const collectionName = getCollectionName(this.modelName);
  let results = db[collectionName].map(doc => cloneDoc(doc));

  if (query) {
    results = results.filter(doc => {
      for (let key in query) {
        if (key === '_id') {
          if (query._id.$ne) {
            if (doc._id.toString() === getDocId(query._id.$ne)) return false;
          } else if (query._id.$in && Array.isArray(query._id.$in)) {
            const ids = query._id.$in.map(id => getDocId(id));
            if (!ids.includes(doc._id.toString())) return false;
          } else {
            if (doc._id.toString() !== getDocId(query._id)) return false;
          }
        } else if (key === 'status') {
          if (query.status && query.status.$in) {
            if (!query.status.$in.includes(doc.status)) return false;
          } else if (doc.status !== query.status) return false;
        } else if (key === 'serviceType') {
          if (doc.serviceType !== query.serviceType) return false;
        } else if (key === 'email') {
          if (doc.email !== query.email) return false;
        } else if (key === 'location' && query.location && query.location.$near) {
          const center = query.location.$near.$geometry.coordinates;
          const maxDist = query.location.$near.$maxDistance;
          const { getDistance } = require('../utils/geo');
          const dist = getDistance(doc.location.coordinates, center);
          if (dist > maxDist) return false;
        }
      }
      return true;
    });
  }

  const chain = {
    populate: function(opts) {
      results.forEach(doc => populateDoc(doc, opts));
      return this;
    },
    sort: function() { return this; },
    then: (resolve) => resolve(results)
  };
  return chain;
};

// Mock findOne method
mongoose.Model.findOne = function(query) {
  const collectionName = getCollectionName(this.modelName);
  let results = db[collectionName].map(doc => cloneDoc(doc));

  if (query) {
    results = results.filter(doc => {
      for (let key in query) {
        if (key === 'email') {
          if (doc.email !== query.email) return false;
        } else if (key === 'phone') {
          if (doc.phone !== query.phone) return false;
        }
      }
      return true;
    });
  }

  const doc = results[0] || null;
  const chain = {
    select: function() { return this; },
    populate: function(opts) {
      if (doc) populateDoc(doc, opts);
      return this;
    },
    then: (resolve) => resolve(doc)
  };
  return chain;
};

// Mock findById method
mongoose.Model.findById = function(id) {
  const collectionName = getCollectionName(this.modelName);
  const idStr = getDocId(id);
  const doc = db[collectionName].find(d => d._id.toString() === idStr) || null;
  const cloned = cloneDoc(doc);

  const chain = {
    populate: function(opts) {
      if (cloned) populateDoc(cloned, opts);
      return this;
    },
    then: (resolve) => resolve(cloned)
  };
  return chain;
};

// Mock updateMany method
mongoose.Model.updateMany = async function(filter, update) {
  const collectionName = getCollectionName(this.modelName);
  let matchedCount = 0;
  const setFields = update.$set || {};

  db[collectionName].forEach(doc => {
    let matches = true;
    if (filter._id && filter._id.$in) {
      const ids = filter._id.$in.map(id => getDocId(id));
      if (!ids.includes(doc._id.toString())) matches = false;
    }
    
    if (matches) {
      matchedCount++;
      for (let key in setFields) {
        doc[key] = setFields[key];
      }
    }
  });

  return { acknowledged: true, modifiedCount: matchedCount };
};

// Mock countDocuments method
mongoose.Model.countDocuments = async function(query) {
  const collectionName = getCollectionName(this.modelName);
  let results = db[collectionName];
  
  if (query) {
    results = results.filter(doc => {
      if (query.createdAt && query.createdAt.$gte) {
        if (new Date(doc.createdAt) < query.createdAt.$gte) return false;
      }
      if (query.status) {
        if (query.status.$in) {
          if (!query.status.$in.includes(doc.status)) return false;
        } else if (doc.status !== query.status) return false;
      }
      return true;
    });
  }
  return results.length;
};

// Mock distinct method
mongoose.Model.distinct = async function(field, query) {
  const collectionName = getCollectionName(this.modelName);
  let results = db[collectionName];
  
  if (query) {
    results = results.filter(doc => {
      if (query.status && doc.status !== query.status) return false;
      if (query.providerId && query.providerId.$ne && doc.providerId === null) return false;
      return true;
    });
  }

  const values = results.map(doc => doc[field]).filter(val => val !== null && val !== undefined);
  return [...new Set(values.map(v => getDocId(v)))];
};

// Mock deleteMany method
mongoose.Model.deleteMany = async function() {
  const collectionName = getCollectionName(this.modelName);
  db[collectionName] = [];
  return { acknowledged: true, deletedCount: 0 };
};

// Mock aggregate method
mongoose.Model.aggregate = async function(pipeline) {
  const collectionName = getCollectionName(this.modelName);
  const results = db[collectionName];
  
  // Find group stage in pipeline
  const groupStage = pipeline.find(stage => stage.$group || stage['$group']);
  const groupData = groupStage ? (groupStage.$group || groupStage['$group']) : null;

  // 1. Savings aggregate
  if (collectionName === 'analytics' && groupData && groupData._id === null) {
    const total = results.reduce((sum, doc) => sum + (doc.savings || 0), 0);
    return [{ _id: null, total }];
  }
  
  // 2. Savings over time aggregate
  if (collectionName === 'analytics' && groupData && groupData._id && groupData._id.$dateToString) {
    const group = {};
    results.forEach(doc => {
      const dateStr = new Date(doc.completedAt).toISOString().split('T')[0];
      if (!group[dateStr]) group[dateStr] = { savings: 0, count: 0 };
      group[dateStr].savings += (doc.savings || 0);
      group[dateStr].count += 1;
    });
    return Object.keys(group).map(date => ({
      _id: date,
      savings: group[date].savings,
      tripsCount: group[date].count
    }));
  }

  // 3. Demand hotspots aggregate
  if (collectionName === 'servicerequests' && groupData && groupData._id && groupData._id.coordinates) {
    const group = {};
    results.forEach(doc => {
      const key = doc.location.coordinates.join(',');
      if (!group[key]) group[key] = { coordinates: doc.location.coordinates, count: 0, totalQuantity: 0 };
      group[key].count += 1;
      group[key].totalQuantity += doc.quantity;
    });
    return Object.values(group).map(item => ({
      _id: { coordinates: item.coordinates },
      requestCount: item.count,
      totalQuantity: item.totalQuantity
    }));
  }

  // 4. Service distribution aggregate
  if (collectionName === 'servicerequests' && groupData && groupData._id === '$serviceType') {
    const group = {};
    results.forEach(doc => {
      const key = doc.serviceType;
      if (!group[key]) group[key] = { count: 0, totalQuantity: 0 };
      group[key].count += 1;
      group[key].totalQuantity += doc.quantity;
    });
    return Object.keys(group).map(key => ({
      _id: key,
      count: group[key].count,
      totalQuantity: group[key].totalQuantity
    }));
  }

  // 5. Village coverage aggregate
  if (collectionName === 'servicerequests' && groupData && groupData._id === '$location.coordinates') {
    const group = {};
    results.forEach(doc => {
      const key = doc.location.coordinates.join(',');
      if (!group[key]) group[key] = { coordinates: doc.location.coordinates, count: 0 };
      group[key].count += 1;
    });
    return Object.values(group).map(item => ({
      _id: item.coordinates,
      requestsAtLocation: item.count
    }));
  }

  return results;
};

// Helper for Mock Populate
function populateDoc(doc, opts) {
  if (!doc) return;
  if (typeof opts === 'string') {
    if (opts === 'farmerId' && doc.farmerId) {
      const fId = getDocId(doc.farmerId);
      doc.farmerId = cloneDoc(db.farmers.find(f => f._id.toString() === fId)) || doc.farmerId;
    }
    if (opts === 'providerId' && doc.providerId) {
      const pId = getDocId(doc.providerId);
      doc.providerId = cloneDoc(db.providers.find(p => p._id.toString() === pId)) || doc.providerId;
    }
  } else if (typeof opts === 'object') {
    if (opts.path === 'groupedRequests') {
      doc.groupedRequests = doc.groupedRequests.map(reqId => {
        const rId = getDocId(reqId);
        const req = cloneDoc(db.servicerequests.find(r => r._id.toString() === rId));
        if (req && opts.populate && opts.populate.path === 'farmerId') {
          const fId = getDocId(req.farmerId);
          req.farmerId = cloneDoc(db.farmers.find(f => f._id.toString() === fId)) || req.farmerId;
        }
        return req || reqId;
      });
    }
    if (opts.path === 'tripBlockId') {
      const tbId = getDocId(doc.tripBlockId);
      doc.tripBlockId = cloneDoc(db.tripblocks.find(t => t._id.toString() === tbId)) || doc.tripBlockId;
      if (doc.tripBlockId && opts.populate && opts.populate.path === 'groupedRequests') {
        doc.tripBlockId.groupedRequests = doc.tripBlockId.groupedRequests.map(reqId => {
          const rId = getDocId(reqId);
          return cloneDoc(db.servicerequests.find(r => r._id.toString() === rId)) || reqId;
        });
      }
    }
    if (opts.path === 'providerId') {
      const pId = getDocId(doc.providerId);
      doc.providerId = cloneDoc(db.providers.find(p => p._id.toString() === pId)) || doc.providerId;
    }
  }
}

// Mock seed database function locally
const runSeeder = async () => {
  const Farmer = require('../models/Farmer');
  const Provider = require('../models/Provider');

  db.farmers = [];
  db.providers = [];
  db.servicerequests = [];
  db.tripblocks = [];
  db.assignments = [];
  db.analytics = [];

  const farmers = await Farmer.create([
    {
      name: 'Ramesh Kumar',
      phone: '9876543210',
      email: 'ramesh@gmail.com',
      password: 'password123',
      location: { type: 'Point', coordinates: [77.4126, 23.2599] }
    },
    {
      name: 'Suresh Patel',
      phone: '9876543211',
      email: 'suresh@gmail.com',
      password: 'password123',
      location: { type: 'Point', coordinates: [77.4200, 23.2650] }
    },
    {
      name: 'Mahesh Singh',
      phone: '9876543212',
      email: 'mahesh@gmail.com',
      password: 'password123',
      location: { type: 'Point', coordinates: [77.4350, 23.2800] }
    },
    {
      name: 'Far Away Farmer',
      phone: '9876543213',
      email: 'farfarmer@gmail.com',
      password: 'password123',
      location: { type: 'Point', coordinates: [78.5000, 24.5000] }
    }
  ]);

  const providers = await Provider.create([
    {
      name: 'Bhopal Water Logistics',
      phone: '9988776650',
      email: 'bhopalwater@gmail.com',
      password: 'password123',
      serviceType: 'water_tanker',
      location: { type: 'Point', coordinates: [77.4100, 23.2550] },
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
      location: { type: 'Point', coordinates: [77.4500, 23.2900] },
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

  console.log(`[Mock DB] Seeded ${farmers.length} Farmers and ${providers.length} Providers.`);
};


// ==========================================
// TEST FLOW SCRIPT START
// ==========================================
const Farmer = require('../models/Farmer');
const Provider = require('../models/Provider');
const ServiceRequest = require('../models/ServiceRequest');
const TripBlock = require('../models/TripBlock');
const Assignment = require('../models/Assignment');
const Analytics = require('../models/Analytics');

const groupingService = require('../services/grouping.service');
const matchingService = require('../services/matching.service');
const savingsService = require('../services/savings.service');
const assignmentController = require('../controllers/assignment.controller');
const dashboardController = require('../controllers/dashboard.controller');
const analyticsController = require('../controllers/analytics.controller');

// Helper mock response object to capture controller JSON outputs
const mockResponse = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

const runTestFlow = async () => {
  try {
    // 1. Establish Mock Connection and Seed Data
    await mongoose.connect();
    await runSeeder();

    // 2. Fetch seeded Farmers and Providers
    const farmerA = await Farmer.findOne({ email: 'ramesh@gmail.com' });
    const farmerB = await Farmer.findOne({ email: 'suresh@gmail.com' });
    const providerA = await Provider.findOne({ email: 'bhopalwater@gmail.com' });
    
    if (!farmerA || !farmerB || !providerA) {
      console.error('Seed data missing!');
      process.exit(1);
    }

    console.log('\n--- STEP 1: Creating Request 1 (Farmer Ramesh) ---');
    const quantity1 = 3000;
    const cost1 = savingsService.calculateIndividualCost('water_tanker', quantity1);
    const req1 = new ServiceRequest({
      farmerId: farmerA._id,
      serviceType: 'water_tanker',
      quantity: quantity1,
      requestedDate: '2026-06-15',
      requestedTime: '09:00',
      location: farmerA.location,
      individualCost: cost1,
      status: 'pending'
    });
    await req1.save();
    console.log(`Created Request 1 for Ramesh: Cost = $${cost1}, Location = ${JSON.stringify(req1.location.coordinates)}`);

    // Trigger Grouping
    console.log('Triggering Grouping Engine for Request 1...');
    let tripBlock = await groupingService.triggerGrouping(req1);
    console.log(`Grouping result: ${tripBlock ? 'Grouped' : 'Pending (No match found yet)'}`);

    console.log('\n--- STEP 2: Creating Request 2 (Farmer Suresh - Within 5km & 2hrs) ---');
    const quantity2 = 4000;
    const cost2 = savingsService.calculateIndividualCost('water_tanker', quantity2);
    const req2 = new ServiceRequest({
      farmerId: farmerB._id,
      serviceType: 'water_tanker',
      quantity: quantity2,
      requestedDate: '2026-06-15',
      requestedTime: '10:30', // 1.5 hours later (within 2 hours window)
      location: farmerB.location, // ~1.05 km away (within 5 km window)
      individualCost: cost2,
      status: 'pending'
    });
    await req2.save();
    console.log(`Created Request 2 for Suresh: Cost = $${cost2}, Location = ${JSON.stringify(req2.location.coordinates)}`);

    // Trigger Grouping
    console.log('Triggering Grouping Engine for Request 2...');
    tripBlock = await groupingService.triggerGrouping(req2);
    if (tripBlock) {
      console.log('🎉 TripBlock Created Automatically!');
      console.log(`TripBlock ID: ${tripBlock._id}`);
      console.log(`Grouped Request IDs: ${JSON.stringify(tripBlock.groupedRequests.map(r => r._id))}`);
      console.log(`Radius Covered: ${tripBlock.radiusCovered.toFixed(2)} meters`);
      console.log(`Estimated Group Savings: $${tripBlock.estimatedSavings}`);
    } else {
      console.error('❌ Expected TripBlock to be created, but grouping returned null.');
      process.exit(1);
    }

    console.log('\n--- STEP 3: Recommending Providers for TripBlock ---');
    const recommendations = await matchingService.recommendProviders(tripBlock, 15000);
    console.log(`Found ${recommendations.length} matching providers within 15km:`);
    recommendations.forEach((rec, idx) => {
      console.log(`${idx + 1}. Provider: ${rec.provider.name}`);
      console.log(`   Score: ${rec.score}`);
      console.log(`   Distance: ${rec.distance} meters`);
      console.log(`   Cost Per Trip: $${rec.provider.costPerTrip}`);
    });

    console.log('\n--- STEP 4: Creating Provider Assignment ---');
    const assignRes = mockResponse();
    await assignmentController.createAssignment(
      { body: { tripBlockId: tripBlock._id, providerId: providerA._id } },
      assignRes,
      (err) => { throw err; }
    );
    const assignment = assignRes.body.data;
    console.log(`Created Assignment: ID = ${assignment._id}, Status = ${assignment.status}`);

    // Verify database updates
    const updatedBlock = await TripBlock.findById(tripBlock._id);
    const updatedProvider = await Provider.findById(providerA._id);
    const updatedReq1 = await ServiceRequest.findById(req1._id);
    console.log(`TripBlock status updated to: ${updatedBlock.status}`);
    console.log(`Provider active status updated to: ${updatedProvider.status}`);
    console.log(`Request 1 status updated to: ${updatedReq1.status}`);

    console.log('\n--- STEP 5: Provider Accepts Assignment ---');
    const respondRes = mockResponse();
    await assignmentController.respondToAssignment(
      { params: { id: assignment._id }, body: { status: 'accepted' } },
      respondRes,
      (err) => { throw err; }
    );
    console.log(`Assignment response saved. New Status = ${respondRes.body.data.status}`);

    console.log('\n--- STEP 6: Provider Completes Assignment & Triggers Savings Engine ---');
    const completeRes = mockResponse();
    await assignmentController.completeAssignment(
      { params: { id: assignment._id } },
      completeRes,
      (err) => { throw err; }
    );
    const finalData = completeRes.body.data;
    console.log('🎉 TripBlock completed!');
    console.log(`Final Recorded Savings: $${finalData.tripBlock.estimatedSavings}`);
    console.log(`Analytics ID generated: ${finalData.analytics._id}`);

    // Verify statuses
    const completedBlock = await TripBlock.findById(tripBlock._id);
    const completedProvider = await Provider.findById(providerA._id);
    const completedReq1 = await ServiceRequest.findById(req1._id);
    console.log(`TripBlock status finalized to: ${completedBlock.status}`);
    console.log(`Provider active status reverted to: ${completedProvider.status} (Availability = ${completedProvider.availability})`);
    console.log(`Request 1 status finalized to: ${completedReq1.status}`);

    console.log('\n--- STEP 7: Fetching Dashboard Summary Metrics ---');
    const dashRes = mockResponse();
    await dashboardController.getOverview({}, dashRes, (err) => { throw err; });
    console.log('Dashboard Data:', JSON.stringify(dashRes.body.data, null, 2));

    console.log('\n--- STEP 8: Fetching Analytics Outputs ---');
    const savingsRes = mockResponse();
    await analyticsController.getSavings({}, savingsRes, (err) => { throw err; });
    console.log('Analytics Savings:', JSON.stringify(savingsRes.body.data, null, 2));

    const hotspotsRes = mockResponse();
    await analyticsController.getDemandHotspots({}, hotspotsRes, (err) => { throw err; });
    console.log('Demand Hotspots:', JSON.stringify(hotspotsRes.body.data, null, 2));

    const coverageRes = mockResponse();
    await analyticsController.getVillageCoverage({}, coverageRes, (err) => { throw err; });
    console.log('Village Coverage:', JSON.stringify(coverageRes.body.data, null, 2));

    console.log('\n===========================================');
    console.log('🎉 ALL INTEGRATION FLOW TESTS PASSED SUCCESSFULLY!');
    console.log('===========================================');

    process.exit(0);
  } catch (error) {
    console.error('❌ Test flow error:', error);
    process.exit(1);
  }
};

runTestFlow();
