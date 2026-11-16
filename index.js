// index.js
require('dotenv').config();
const admin = require('firebase-admin');
const cron = require('node-cron');

// 1. Firebase Admin Initialization
// (Hugging Face-la Secret variables ah kuduppom)
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Important for multiline keys
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 2. The Core Function: Check Bikes & Send Notifications
async function checkInventoryAndNotify() {
  console.log('Running inventory check...', new Date().toLocaleString());
  
  try {
    // a. Get Admin Token
    const tokenDoc = await db.collection('admin_tokens').doc('main_admin').get();
    if (!tokenDoc.exists) {
      console.log("No admin token found. Skipping notifications.");
      return;
    }
    const adminToken = tokenDoc.data().token;

    // b. Get All In-Stock Bikes
    const bikesSnapshot = await db.collection('bikes').where('status', '==', 'in-stock').get();
    
    const today = new Date();
    const notificationsToSend = [];

    bikesSnapshot.forEach(doc => {
      const bike = doc.data();
      const purchaseDate = new Date(bike.purchaseDate);
      
      // Calculate days in stock
      const diffTime = Math.abs(today - purchaseDate);
      const daysInStock = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

      // If bike is in stock for exactly 15 days, 30 days, or 45 days
      if (daysInStock === 15 || daysInStock === 30 || daysInStock === 45) {
        notificationsToSend.push({
          title: `Dead Stock Alert! 🚨`,
          body: `${bike.make} ${bike.model} (${bike.regNo}) has been in stock for ${daysInStock} days. Action needed!`,
        });
      }
    });

    // c. Send Push Notifications (if any)
    for (const notification of notificationsToSend) {
      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
        },
        token: adminToken,
      };

      try {
        const response = await admin.messaging().send(message);
        console.log('Successfully sent message:', response);
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }
    
    if(notificationsToSend.length === 0) {
        console.log("All good! No aging stock today.");
    }

  } catch (error) {
    console.error('Error during inventory check:', error);
  }
}

// 3. Schedule the Cron Job (Runs every day at 10:00 AM)
// Format: minute hour day month dayOfWeek
cron.schedule('0 10 * * *', () => {
  checkInventoryAndNotify();
}, {
  timezone: "Asia/Kolkata" 
});
  
console.log("MotoTrack Backend Started. Cron job scheduled for 10 AM IST daily.");

// Simple health check endpoint (Optional, just to keep Hugging Face happy)
const http = require('http');
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('MotoTrack Backend is running.\n');
}).listen(7860); // 7860 is the default port Hugging Face expects