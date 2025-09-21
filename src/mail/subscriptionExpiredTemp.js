const subscriptionExpiredTemp = (data) =>
    ` 
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                background-color: #f2f3f8;
                margin: 0;
                padding: 0;
              }
              .container {
                max-width: 600px;
                margin: 40px auto;
                background-color: #ffffff;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
              }
              h1 {
                color: #022C22;
                font-size: 26px;
                margin-bottom: 20px;
                font-weight: bold;
                text-align: center;
              }
              p {
                color: #555555;
                line-height: 1.8;
                font-size: 16px;
                margin-bottom: 20px;
              }
              table {
                width: fit-content;
                border-collapse: collapse;
                margin: 20px 0;
              }
              table th, table td {
                padding: 12px;
                text-align: left;
                border: 1px solid #ddd;
              }
              table th {
                background-color: #f2f3f8;
                font-weight: bold;
              }
              .logo {
                text-align: center;
              }
              .logo-img {
                max-width: 100%;
                margin-bottom: 20px;
              }
              .footer {
                margin-top: 30px;
                font-size: 13px;
                color: #9e9e9e;
                text-align: center;
              }
              .footer p {
                margin: 5px 0;
              }
              a {
                color: #022C22;
                text-decoration: none;
              }
            </style>
          </head>
          <body>
            <div class="container">
  
              <div class="logo">
                <img src="${process.env.EMAIL_TEMP_IMAGE}" alt="Logo" class="logo-img" />
              </div>
  
              <h1>Subscription Expired</h1>
              <p>Hello</p>
              <p>We wanted to let you know that your subscription with <strong>Mathsbook</strong> has expired.</p>
              <p>To continue enjoying our expert picks and premium features, please consider renewing your subscription.</p>
              <p>If you need any assistance or have questions, feel free to contact us at <a href="mailto:arifishtiaque.sparktech@gmail.com">arifishtiaque.sparktech@gmail.com</a>.</p>
              <p>Best regards,<br>The Mathsbook Team</p>
            </div>
            <div class="footer">
              <p>&copy; Mathsbook - All Rights Reserved.</p>
              <p><a href="https://yourwebsite.com/privacy">Privacy Policy</a> | <a href="https://yourwebsite.com/contact">Contact Support</a></p>
            </div>
          </body>
        </html>
      `;
  
  module.exports = subscriptionExpiredTemp;
  