/**
 * Email service using nodemailer with Gmail SMTP
 */

const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Admin email address
const ADMIN_EMAIL = process.env.GMAIL_USER;

/**
 * Format game list for email
 */
function formatGameList(items) {
  let html = '<ul style="margin: 10px 0; padding-left: 20px;">';
  
  items.forEach(item => {
    const type = item.type === 'boardgame' ? '🎲 Boardgame' : '🎮 Videogame';
    html += `<li><strong>${item.name}</strong> (${type})</li>`;
  });
  
  html += '</ul>';
  return html;
}

/**
 * Format game list for admin with installation status
 */
async function formatGameListForAdmin(items) {
  // Load game data to check installation status
  let videogames = [];
  let boardgames = [];
  
  try {
    const fs = require('fs').promises;
    const path = require('path');
    // Go up one directory to access assets folder
    const videogamesData = await fs.readFile(path.join(__dirname, '../assets/list/games.json'), 'utf8');
    const boardgamesData = await fs.readFile(path.join(__dirname, '../assets/list/boardgames.json'), 'utf8');
    videogames = JSON.parse(videogamesData);
    boardgames = JSON.parse(boardgamesData);
  } catch (error) {
    console.error('Error loading game data for email:', error);
  }
  
  let html = '<table style="border-collapse: collapse; margin: 10px 0;">';
  html += '<tr style="background-color: #f0f0f0;"><th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Game</th><th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Type</th><th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Status</th></tr>';
  
  items.forEach(item => {
    const type = item.type === 'boardgame' ? '🎲 Boardgame' : '🎮 Videogame';
    let status = 'N/A';
    
    if (item.type === 'videogame') {
      const game = videogames.find(g => g.id === item.id);
      status = game && game.installed ? '✅ Installed' : '⏳ Not Installed';
    } else {
      const game = boardgames.find(g => g.id === item.id);
      status = game && game.copies ? `📦 ${game.copies} copies` : '📦 Available';
    }
    
    html += `<tr><td style="border: 1px solid #ddd; padding: 8px;"><strong>${item.name}</strong></td><td style="border: 1px solid #ddd; padding: 8px;">${type}</td><td style="border: 1px solid #ddd; padding: 8px;">${status}</td></tr>`;
  });
  
  html += '</table>';
  return html;
}

/**
 * Send confirmation email to user
 */
async function sendUserConfirmation(reservation, isUpdate = false) {
  const items = typeof reservation.items === 'string' 
    ? JSON.parse(reservation.items) 
    : reservation.items;
  
  const subject = isUpdate 
    ? `Kaptam Reservation Updated - Code: ${reservation.code}`
    : `Kaptam Reservation Confirmation - Code: ${reservation.code}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #FFC107; color: #000; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 20px; margin-top: 20px; }
        .code { font-size: 32px; font-weight: bold; color: #FFC107; text-align: center; letter-spacing: 3px; margin: 20px 0; }
        .info-row { margin: 10px 0; }
        .label { font-weight: bold; color: #555; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Kaptam Gamers</h1>
          <p>${isUpdate ? 'Reservation Updated' : 'Reservation Confirmed'}</p>
        </div>
        
        <div class="content">
          <p>Hello <strong>${reservation.name}</strong>,</p>
          
          <p>${isUpdate ? 'Your reservation has been updated successfully!' : 'Thank you for your reservation!'}</p>
          
          <p>Your reservation code is:</p>
          <div class="code">${reservation.code}</div>
          
          <p><strong>Please save this code!</strong> You'll need it to access your reservation.</p>
          
          <h3>Reservation Details:</h3>
          
          <div class="info-row">
            <span class="label">Games Reserved:</span>
            ${formatGameList(items)}
          </div>
          
          ${reservation.date ? `
          <div class="info-row">
            <span class="label">Visit Date:</span> ${reservation.date}
          </div>
          ` : ''}
          
          <div class="info-row">
            <span class="label">Controller Needed:</span> ${reservation.controller === 'yes' ? 'Yes' : 'No'}
          </div>
          
          ${reservation.additionalInfo ? `
          <div class="info-row">
            <span class="label">Additional Info:</span> ${reservation.additionalInfo}
          </div>
          ` : ''}
          
          <h3>What's Next?</h3>
          <ul>
            <li>Keep your reservation code safe</li>
            <li>Games marked as "Not Installed" will be installed within 3-5 days</li>
            <li>Visit us at: <strong>Mukkulankatu 19, 15210 Lahti</strong></li>
            <li>Questions? Contact us: <a href="mailto:kaptamgamers@gmail.com">kaptamgamers@gmail.com</a></li>
          </ul>
        </div>
        
        <div class="footer">
          <p>This is an automated message from Kaptam Gamers ry.</p>
          <p>Mukkulankatu 19, 15210 Lahti | +358 40 850 5051</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const mailOptions = {
    from: `"Kaptam Gamers" <${process.env.GMAIL_USER}>`,
    to: reservation.email,
    subject: subject,
    html: html
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('User confirmation email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Failed to send user confirmation email:', error);
    throw error;
  }
}

/**
 * Send notification email to admin
 */
async function sendAdminNotification(reservation, isUpdate = false) {
  const items = typeof reservation.items === 'string' 
    ? JSON.parse(reservation.items) 
    : reservation.items;
  
  const subject = isUpdate
    ? `Reservation Updated - ${reservation.name} - Code: ${reservation.code}`
    : `New Reservation - ${reservation.name} - Code: ${reservation.code}`;
  
  const gameListHtml = await formatGameListForAdmin(items);
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 700px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2196F3; color: #fff; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 20px; margin-top: 20px; }
        .code { font-size: 24px; font-weight: bold; color: #2196F3; margin: 10px 0; }
        .info-row { margin: 10px 0; padding: 8px; background: white; border-left: 3px solid #2196F3; }
        .label { font-weight: bold; color: #555; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f0f0f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎮 ${isUpdate ? 'Reservation Updated' : 'New Reservation'}</h1>
          <p>Kaptam Admin Notification</p>
        </div>
        
        <div class="content">
          <h2>Reservation Code: <span class="code">${reservation.code}</span></h2>
          
          <div class="info-row">
            <span class="label">Customer Name:</span> ${reservation.name}
          </div>
          
          ${reservation.email ? `
          <div class="info-row">
            <span class="label">Email:</span> <a href="mailto:${reservation.email}">${reservation.email}</a>
          </div>
          ` : `
          <div class="info-row">
            <span class="label">Email:</span> <em>Not provided</em>
          </div>
          `}
          
          ${reservation.date ? `
          <div class="info-row">
            <span class="label">Visit Date:</span> ${reservation.date}
          </div>
          ` : ''}
          
          <div class="info-row">
            <span class="label">Controller Needed:</span> ${reservation.controller === 'yes' ? 'Yes ✅' : 'No ❌'}
          </div>
          
          ${reservation.additionalInfo ? `
          <div class="info-row">
            <span class="label">Additional Info:</span> ${reservation.additionalInfo}
          </div>
          ` : ''}
          
          <div class="info-row">
            <span class="label">Created:</span> ${new Date(reservation.createdAt).toLocaleString('fi-FI')}
          </div>
          
          ${reservation.updatedAt ? `
          <div class="info-row">
            <span class="label">Updated:</span> ${new Date(reservation.updatedAt).toLocaleString('fi-FI')}
          </div>
          ` : ''}
          
          <h3>Games Reserved (${items.length} items):</h3>
          ${gameListHtml}
          
          <h3>Action Required:</h3>
          <ul>
            <li>Check for games marked as "⏳ Not Installed"</li>
            <li>Install required games within 3-5 days</li>
            <li>Prepare controller if requested</li>
            ${reservation.date ? `<li>Customer plans to visit on: <strong>${reservation.date}</strong></li>` : ''}
          </ul>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const mailOptions = {
    from: `"Kaptam Reservations" <${process.env.GMAIL_USER}>`,
    to: ADMIN_EMAIL,
    subject: subject,
    html: html
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Admin notification email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Failed to send admin notification email:', error);
    throw error;
  }
}

// Verify transporter configuration
transporter.verify(function (error, success) {
  if (error) {
    console.error('Email transporter verification failed:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

module.exports = {
  sendUserConfirmation,
  sendAdminNotification
};