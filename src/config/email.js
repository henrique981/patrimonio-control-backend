const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const enviarEmail = async (para, assunto, mensagem) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: para,
      subject: assunto,
      html: mensagem
    });
    console.log('Email enviado com sucesso para:', para);
  } catch (err) {
    console.error('Erro ao enviar email:', err);
  }
};

module.exports = { enviarEmail };
