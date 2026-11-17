require('dotenv').config();
const admin = require('firebase-admin');
const express = require('express');

// Firebase Setup
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
};

if (serviceAccount.projectId) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin Initialized Successfully.");
}

const db = admin.firestore ? admin.firestore() : null;
const app = express();

// Simple endpoint to keep Render awake
app.get('/', (req, res) => {
  res.send('MotoTrack Backend is Alive!');
});

// The Cron Endpoint (cron-job.org will hit this)
app.get('/trigger-alerts', async (req, res) => {
  if(!db) return res.status(500).send("DB not connected");
  console.log('Running inventory check...', new Date().toLocaleString());
  
  try {
    const tokenDoc = await db.collection('admin_tokens').doc('main_admin').get();
    if (!tokenDoc.exists) return res.send("No admin token found");
    const adminToken = tokenDoc.data().token;

    const bikesSnapshot = await db.collection('bikes').where('status', '==', 'in-stock').get();
    const today = new Date();
    const notifications = [];

    bikesSnapshot.forEach(doc => {
      const bike = doc.data();
      const diffTime = Math.abs(today - new Date(bike.purchaseDate));
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

      if (days === 15 || days === 30 || days === 45) {
        notifications.push({
          title: `Dead Stock Alert! 🚨`,
          body: `${bike.make} ${bike.model} (${bike.regNo}) is in stock for ${days} days.`,
        });
      }
    });

    for (const notif of notifications) {
      await admin.messaging().send({ notification: notif, token: adminToken });
    }
    
    res.send(`Checked inventory. Sent ${notifications.length} alerts.`);
  } catch (error) {
    console.error('Check failed:', error);
    res.status(500).send("Error running check");
  }
});

// Port configuration for Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});