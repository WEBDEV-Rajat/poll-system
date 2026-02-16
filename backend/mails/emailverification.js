export const generateVerificationEmail = (code) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Verification Code</title>
</head>
<body style="margin:0; padding:0; background:#f4f6f8; font-family: Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8; padding:40px 0;">
    <tr>
      <td align="center">

        <table width="500" cellpadding="0" cellspacing="0" style="background:white; border-radius:8px; padding:30px;">

          <tr>
            <td align="center">
              <h2 style="margin:0; color:#1f2937;">Verify Your Vote</h2>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:20px 0 10px 0; color:#4b5563;">
              You requested to vote in a poll. Use the verification code below:
            </td>
          </tr>

          <tr>
            <td align="center">
              <div style="
                display:inline-block;
                padding:15px 30px;
                border-radius:8px;
                background:#eff6ff;
                border:2px solid #2563eb;
                font-size:32px;
                font-weight:bold;
                letter-spacing:8px;
                color:#2563eb;
                margin:20px 0;">
                ${code}
              </div>
            </td>
          </tr>

          <tr>
            <td align="center" style="color:#374151; padding-top:10px;">
              This code expires in <strong>10 minutes</strong>.
            </td>
          </tr>

          <tr>
            <td align="center" style="color:#6b7280; font-size:13px; padding-top:25px; border-top:1px solid #e5e7eb;">
              If you didn’t request this, you can safely ignore this email.
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`;
