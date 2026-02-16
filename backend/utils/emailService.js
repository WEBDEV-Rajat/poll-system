import nodeMailer from "nodemailer";

export const sendEmail = async ({ email, subject, htmlContent }) => {
  try {
    const transporter = nodeMailer.createTransport({
      service: process.env.SMTP_SERVICE,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
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
