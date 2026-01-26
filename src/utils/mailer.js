import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS
    }
});

export const sendVerificationEmail = async (email, token) => {
    // Enlace a la página de verificación (que crearemos abajo)
    const verificationUrl = `${process.env.FRONTEND_URL}/verify.html?token=${token}`;

    const emailHtml = `
    <div style="background-color: #050505; color: #ffffff; font-family: 'Courier New', sans-serif; padding: 40px; text-align: center; border: 1px solid #d90429;">
        <h1 style="color: #d90429; font-size: 32px; letter-spacing: 5px; margin-bottom: 5px;">AIDFLOW</h1>
        <p style="color: #ffb703; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin-top:0;">Comando Central</p>
        
        <hr style="border: 0; border-top: 1px dashed #333; margin: 30px 0;">

        <h2 style="color: #ffffff;">CONFIRMACIÓN DE ACCESO</h2>
        <p style="color: #cccccc; max-width: 500px; margin: 0 auto; line-height: 1.5;">
            Guerrero, tu solicitud para unirte al Dojo ha sido recibida. 
            Para activar tu ciclo de prosperidad, debes verificar tu honor.
        </p>

        <div style="background: #111; border-left: 3px solid #d90429; padding: 15px; margin: 30px auto; max-width: 400px; text-align: left;">
            <strong style="color: #ffb703;">TUS BENEFICIOS AL ACTIVAR EL PASE:</strong>
            <ul style="color: #aaa; font-size: 13px; padding-left: 20px; margin-top: 10px;">
                <li>🔄 Acceso a Ciclos de Ayuda Mutua.</li>
                <li>⚔️ Participación en Torneos PVP.</li>
                <li>💰 Recompensas del Fondo DAO.</li>
            </ul>
        </div>

        <a href="${verificationUrl}" style="background-color: #d90429; color: #000; padding: 15px 40px; text-decoration: none; font-weight: 900; font-size: 14px; display: inline-block; margin-top: 10px; border: 1px solid #d90429;">
            VERIFICAR AHORA >
        </a>

        <p style="margin-top: 50px; font-size: 10px; color: #444;">
            Si no iniciaste este proceso, elimina este mensaje.<br>
            AidFlow Ninja © Protocolo Seguro.
        </p>
    </div>
    `;

    try {
        await transporter.sendMail({
            from: `"AidFlow Shogun" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "⚔️ Activa tu Pase - AidFlow Ninja",
            html: emailHtml
        });
        console.log(`📧 Flyer enviado a: ${email}`);
    } catch (error) {
        console.error("❌ Error enviando correo:", error);
    }
};