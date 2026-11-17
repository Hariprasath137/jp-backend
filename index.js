require('dotenv').config();
const express = require('express');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
};

let db = null;

if (serviceAccount.projectId) {
    initializeApp({
        credential: cert(serviceAccount)
    });
    console.log("Firebase Admin Initialized Successfully.");
    db = getFirestore();
}

const app = express();

app.get('/', (req, res) => {
  res.send('MotoTrack Backend is Alive!');
});

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

      if (days >= 0) { // Testing condition
        notifications.push({
          bikeId: doc.id,
          title: `Dead Stock Alert! 🚨`,
          body: `${bike.make} ${bike.model} (${bike.regNo}) is in stock for ${days} days.`
        });
      }
    });

    const now = Date.now();
    let sentCount = 0;

    for (const notif of notifications) {
      // 1. ITHU THAAN MUKKIYAM: Database-la save pandrom (Ithu automatic a table create pannidum!)
      await db.collection('notifications').add({
        title: notif.title,
        body: notif.body,
        bikeId: notif.bikeId,
        timestamp: now,
        read: false
      });

      // 2. Phone ku push anuppurom
      await getMessaging().send({
        token: adminToken,
        notification: {
          title: notif.title,
          body: notif.body
        },
        data: {
          bikeId: notif.bikeId
        }
      });
      
      sentCount++;
    }
    
    res.send(`Checked inventory. Sent & Saved ${sentCount} alerts.`);
  } catch (error) {
    console.error('Check failed:', error);
    res.status(500).send("Error running check");
  }
});

const PORT = process.env.PORT || 10000;
// '0.0.0.0' add panna thaan Render udane "Live" nu maathum
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});