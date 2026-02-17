import nodeMailer from "nodemailer";

export const sendEmail = async ({ email, subject, htmlContent }) => {
  try {
    const transporter = nodeMailer.createTransport({
      host: process.env.SMTP_HOST,
      service: process.env.SMTP_SERVICE,
      port: Number(process.env.SMTP_PORT), 
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      family:4,
      secure:false
    });
    const options = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      html: htmlContent,
    };
    
    await transporter.sendMail(options);
    console.log("Mail sent successfully");
  } catch (error) {
    console.error("Couldn't send mail:", error);
    
  }
};
