import nodemailer from "nodemailer";

// Configura esto con tus datos reales (Gmail, Outlook, o hosting SMTP)
// Si usas Gmail, necesitas una "App Password", no tu contraseña normal.
const transporter = nodemailer.createTransport({
    service: "gmail", // O host: 'smtp.tuservidor.com'
    auth: {
        user: "tu_correo_del_clan@gmail.com", 
        pass: "tu_password_de_aplicacion" 
    }
});

export const sendVerificationEmail = async (email, token) => {
    // Cambia esta URL por la de tu frontend real/producción
    const url = `http://localhost:3000/verify.html?token=${token}`;

    const mailOptions = {
        from: '"AidFlow Ninja Dojo" <no-reply@aidflowninja.com>',
        to: email,
        subject: "🥷 Confirma tu identidad - AidFlow Ninja",
        html: `
            <div style="background:#000; color:#fff; padding:20px; font-family:sans-serif; border: 2px solid #d90429;">
                <h1 style="color:#ffb703;">BIENVENIDO AL CLAN</h1>
                <p>Para activar tu Pase Ninja, debes verificar este correo.</p>
                <p>Haz clic en el siguiente enlace:</p>
                <a href="${url}" style="background:#d90429; color:#fff; padding:10px 20px; text-decoration:none; font-weight:bold;">CONFIRMAR IDENTIDAD</a>
                <p style="margin-top:20px; color:#666; font-size:12px;">Si no solicitaste esto, ignora el mensaje.</p>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
};