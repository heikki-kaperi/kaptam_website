/**
 * Email Service Module
 * Handles sending order notifications via Gmail SMTP
 */

const nodemailer = require('nodemailer');

// Create transporter
let transporter;

function initTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
  }
  return transporter;
}

// Format game list for email
function formatGameList(items) {
  return items.map((item, index) => `${index + 1}. ${item.name}`).join('\n');
}

// Format game list as HTML
function formatGameListHtml(items) {
  return items.map(item => `<li style="padding: 5px 0;">${item.name}</li>`).join('');
}

// Send order notification to admin
async function sendOrderNotification(orderData) {
  const { code, items, name, email, controller, additionalInfo, modifyLink } = orderData;

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: 'kaptamgamers@gmail.com',
    subject: `New Game Order - ${code}`,
    text: `
New Game Order Received!

Order Code: ${code}
Name: ${name}
Email: ${email || 'Not provided'}
Preferred Input: ${controller === 'keyboard-mouse' ? 'Keyboard & Mouse' : 'Controller'}

Games Ordered:
${formatGameList(items)}

${additionalInfo ? `Additional Info:\n${additionalInfo}` : ''}

Modify Order Link:
${modifyLink}

---
This is an automated message from Kaptam Gamers website.
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; padding: 20px; text-align: center; }
    .header h1 { margin: 0; color: #f5a623; }
    .content { background: #f9f9f9; padding: 20px; }
    .info-row { margin: 10px 0; }
    .label { font-weight: bold; color: #666; }
    .games-list { background: #fff; padding: 15px; border-left: 4px solid #f5a623; margin: 15px 0; }
    .games-list ul { margin: 0; padding-left: 20px; }
    .additional { background: #fff3cd; padding: 15px; margin: 15px 0; border-radius: 4px; }
    .code-box { background: #1a1a2e; color: #f5a623; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 3px; margin: 15px 0; }
    .link-btn { display: inline-block; background: #f5a623; color: #1a1a2e; padding: 12px 25px; text-decoration: none; font-weight: bold; margin: 10px 0; }
    .footer { text-align: center; color: #999; font-size: 12px; padding: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Game Order!</h1>
    </div>
    <div class="content">
      <div class="code-box">${code}</div>

      <div class="info-row">
        <span class="label">Name:</span> ${name}
      </div>
      <div class="info-row">
        <span class="label">Email:</span> ${email || 'Not provided'}
      </div>
      <div class="info-row">
        <span class="label">Preferred Input:</span> ${controller === 'keyboard-mouse' ? 'Keyboard & Mouse' : 'Controller'}
      </div>

      <div class="games-list">
        <strong>Games Ordered (${items.length}):</strong>
        <ul>
          ${formatGameListHtml(items)}
        </ul>
      </div>

      ${additionalInfo ? `<div class="additional"><strong>Additional Info:</strong><br>${additionalInfo}</div>` : ''}

      <p style="text-align: center;">
        <a href="${modifyLink}" class="link-btn">View/Modify Order</a>
      </p>
    </div>
    <div class="footer">
      This is an automated message from Kaptam Gamers website.
    </div>
  </div>
</body>
</html>
    `
  };

  try {
    initTransporter();
    await transporter.sendMail(mailOptions);
    console.log(`Admin notification sent for order ${code}`);
  } catch (error) {
    console.error('Failed to send admin notification:', error);
    // Don't throw - email failure shouldn't break the order
  }
}

// Send confirmation to user
async function sendUserConfirmation(orderData) {
  const { code, items, name, email, controller, additionalInfo, modifyLink } = orderData;

  if (!email) return;

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: `Your Kaptam Game Order - ${code}`,
    text: `
Hi ${name}!

Thank you for your game order at Kaptam Gamers!

Your Order Code: ${code}
(Save this code if you want to modify your order later)

Preferred Input: ${controller === 'keyboard-mouse' ? 'Keyboard & Mouse' : 'Controller'}

Games Ordered:
${formatGameList(items)}

${additionalInfo ? `Your Notes:\n${additionalInfo}` : ''}

Want to change your order?
Visit: ${modifyLink}

Note: Not installed games with large install sizes might take 3-5 days to be installed.

---
Kaptam Gamers ry
Mukkulankatu 19, 15210 Lahti
kaptamgamers@gmail.com
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; padding: 30px; text-align: center; }
    .header h1 { margin: 0 0 10px 0; color: #f5a623; }
    .content { background: #f9f9f9; padding: 20px; }
    .code-box { background: #1a1a2e; color: #f5a623; padding: 20px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 4px; margin: 20px 0; border-radius: 8px; }
    .code-note { text-align: center; color: #666; font-size: 14px; margin-bottom: 20px; }
    .games-list { background: #fff; padding: 15px 20px; border-left: 4px solid #f5a623; margin: 20px 0; }
    .games-list ul { margin: 10px 0; padding-left: 20px; }
    .info-box { background: #e3f2fd; padding: 15px; margin: 15px 0; border-radius: 4px; }
    .link-btn { display: inline-block; background: #f5a623; color: #1a1a2e; padding: 15px 30px; text-decoration: none; font-weight: bold; border-radius: 4px; margin: 10px 0; }
    .notice { background: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 4px; font-size: 14px; }
    .footer { text-align: center; color: #999; font-size: 12px; padding: 20px; border-top: 1px solid #eee; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Thank you for your order!</h1>
      <p style="margin: 0; opacity: 0.9;">Hi ${name}!</p>
    </div>
    <div class="content">
      <p>Your game order has been received. Here are your order details:</p>

      <div class="code-box">${code}</div>
      <p class="code-note">Save this code if you want to modify your order later</p>

      <div class="info-box">
        <strong>Preferred Input:</strong> ${controller === 'keyboard-mouse' ? 'Keyboard & Mouse' : 'Controller'}
      </div>

      <div class="games-list">
        <strong>Games Ordered (${items.length}):</strong>
        <ul>
          ${formatGameListHtml(items)}
        </ul>
      </div>

      ${additionalInfo ? `<div class="info-box"><strong>Your Notes:</strong><br>${additionalInfo}</div>` : ''}

      <div class="notice">
        <strong>Note:</strong> Not installed games with large install sizes might take 3-5 days to be installed.
      </div>

      <p style="text-align: center;">
        <a href="${modifyLink}" class="link-btn">Modify Your Order</a>
      </p>
    </div>
    <div class="footer">
      <strong>Kaptam Gamers ry</strong><br>
      Mukkulankatu 19, 15210 Lahti<br>
      kaptamgamers@gmail.com
    </div>
  </div>
</body>
</html>
    `
  };

  try {
    initTransporter();
    await transporter.sendMail(mailOptions);
    console.log(`User confirmation sent to ${email} for order ${code}`);
  } catch (error) {
    console.error('Failed to send user confirmation:', error);
  }
}

// Send update notification to admin
async function sendOrderUpdateNotification(orderData) {
  const { code, items, name, email, controller, additionalInfo, modifyLink } = orderData;

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: 'kaptamgamers@gmail.com',
    subject: `Order Updated - ${code}`,
    text: `
Order Has Been Updated!

Order Code: ${code}
Name: ${name}
Email: ${email || 'Not provided'}
Preferred Input: ${controller === 'keyboard-mouse' ? 'Keyboard & Mouse' : 'Controller'}

Updated Games List:
${formatGameList(items)}

${additionalInfo ? `Additional Info:\n${additionalInfo}` : ''}

View Order Link:
${modifyLink}

---
This is an automated message from Kaptam Gamers website.
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%); color: #fff; padding: 20px; text-align: center; }
    .header h1 { margin: 0; }
    .content { background: #f9f9f9; padding: 20px; }
    .info-row { margin: 10px 0; }
    .label { font-weight: bold; color: #666; }
    .games-list { background: #fff; padding: 15px; border-left: 4px solid #4caf50; margin: 15px 0; }
    .games-list ul { margin: 0; padding-left: 20px; }
    .additional { background: #fff3cd; padding: 15px; margin: 15px 0; border-radius: 4px; }
    .code-box { background: #1a1a2e; color: #4caf50; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 3px; margin: 15px 0; }
    .link-btn { display: inline-block; background: #4caf50; color: #fff; padding: 12px 25px; text-decoration: none; font-weight: bold; margin: 10px 0; }
    .footer { text-align: center; color: #999; font-size: 12px; padding: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Order Updated!</h1>
    </div>
    <div class="content">
      <div class="code-box">${code}</div>

      <div class="info-row">
        <span class="label">Name:</span> ${name}
      </div>
      <div class="info-row">
        <span class="label">Email:</span> ${email || 'Not provided'}
      </div>
      <div class="info-row">
        <span class="label">Preferred Input:</span> ${controller === 'keyboard-mouse' ? 'Keyboard & Mouse' : 'Controller'}
      </div>

      <div class="games-list">
        <strong>Updated Games List (${items.length}):</strong>
        <ul>
          ${formatGameListHtml(items)}
        </ul>
      </div>

      ${additionalInfo ? `<div class="additional"><strong>Additional Info:</strong><br>${additionalInfo}</div>` : ''}

      <p style="text-align: center;">
        <a href="${modifyLink}" class="link-btn">View Order</a>
      </p>
    </div>
    <div class="footer">
      This is an automated message from Kaptam Gamers website.
    </div>
  </div>
</body>
</html>
    `
  };

  try {
    initTransporter();
    await transporter.sendMail(mailOptions);
    console.log(`Admin update notification sent for order ${code}`);
  } catch (error) {
    console.error('Failed to send admin update notification:', error);
  }
}

// Send update confirmation to user
async function sendUserUpdateConfirmation(orderData) {
  const { code, items, name, email, controller, additionalInfo, modifyLink } = orderData;

  if (!email) return;

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: `Your Kaptam Order Updated - ${code}`,
    text: `
Hi ${name}!

Your game order at Kaptam Gamers has been updated.

Your Order Code: ${code}

Preferred Input: ${controller === 'keyboard-mouse' ? 'Keyboard & Mouse' : 'Controller'}

Updated Games List:
${formatGameList(items)}

${additionalInfo ? `Your Notes:\n${additionalInfo}` : ''}

Want to make more changes?
Visit: ${modifyLink}

---
Kaptam Gamers ry
Mukkulankatu 19, 15210 Lahti
kaptamgamers@gmail.com
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%); color: #fff; padding: 30px; text-align: center; }
    .header h1 { margin: 0 0 10px 0; }
    .content { background: #f9f9f9; padding: 20px; }
    .code-box { background: #1a1a2e; color: #4caf50; padding: 20px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 4px; margin: 20px 0; border-radius: 8px; }
    .games-list { background: #fff; padding: 15px 20px; border-left: 4px solid #4caf50; margin: 20px 0; }
    .games-list ul { margin: 10px 0; padding-left: 20px; }
    .info-box { background: #e8f5e9; padding: 15px; margin: 15px 0; border-radius: 4px; }
    .link-btn { display: inline-block; background: #4caf50; color: #fff; padding: 15px 30px; text-decoration: none; font-weight: bold; border-radius: 4px; margin: 10px 0; }
    .footer { text-align: center; color: #999; font-size: 12px; padding: 20px; border-top: 1px solid #eee; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Order Updated!</h1>
      <p style="margin: 0; opacity: 0.9;">Hi ${name}!</p>
    </div>
    <div class="content">
      <p>Your game order has been successfully updated.</p>

      <div class="code-box">${code}</div>

      <div class="info-box">
        <strong>Preferred Input:</strong> ${controller === 'keyboard-mouse' ? 'Keyboard & Mouse' : 'Controller'}
      </div>

      <div class="games-list">
        <strong>Updated Games List (${items.length}):</strong>
        <ul>
          ${formatGameListHtml(items)}
        </ul>
      </div>

      ${additionalInfo ? `<div class="info-box"><strong>Your Notes:</strong><br>${additionalInfo}</div>` : ''}

      <p style="text-align: center;">
        <a href="${modifyLink}" class="link-btn">Make More Changes</a>
      </p>
    </div>
    <div class="footer">
      <strong>Kaptam Gamers ry</strong><br>
      Mukkulankatu 19, 15210 Lahti<br>
      kaptamgamers@gmail.com
    </div>
  </div>
</body>
</html>
    `
  };

  try {
    initTransporter();
    await transporter.sendMail(mailOptions);
    console.log(`User update confirmation sent to ${email} for order ${code}`);
  } catch (error) {
    console.error('Failed to send user update confirmation:', error);
  }
}

module.exports = {
  sendOrderNotification,
  sendUserConfirmation,
  sendOrderUpdateNotification,
  sendUserUpdateConfirmation
};
