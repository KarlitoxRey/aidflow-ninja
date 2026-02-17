import { CONFIG } from "./config.js";
import { ninjaFetch } from "./api.js";

/* =====================
    LOGIN
===================== */
const loginForm = document.getElementById("loginForm");

loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = loginForm.querySelector("input[type='email']").value;
    const password = loginForm.querySelector("input[type='password']").value;

    try {
        // Usamos ninjaFetch
        const res = await ninjaFetch(CONFIG.ENDPOINTS.LOGIN, {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });

        if (!res) return; // Si hubo error de red

        const data = await res.json();
        
        if (!res.ok) {
            alert(`⚠️ ${data.error || "Credenciales incorrectas"}`);
            return;
        }

        // 🔐 Guardar sesión
        localStorage.setItem(CONFIG.STORAGE.TOKEN, data.token);
        localStorage.setItem(CONFIG.STORAGE.ROLE, data.user.role.toLowerCase()); // Normalizamos a minúsculas
        localStorage.setItem(CONFIG.STORAGE.USER_NAME, data.user.ninjaName);

        // Redirección inteligente
        if (data.user.role.toLowerCase() === CONFIG.ROLES.SHOGUN) {
            window.location.replace(CONFIG.PAGES.ADMIN);
        } else {
            window.location.replace(CONFIG.PAGES.DASHBOARD);
        }

    } catch (err) {
        // El error ya se muestra en api.js
    }
});

/* =====================
    REGISTER
===================== */
const registerForm = document.getElementById("registerForm");

registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const acceptTerms = document.getElementById("acceptTerms");
    if (!acceptTerms || !acceptTerms.checked) {
        alert("Debes aceptar el Código de Honor.");
        return;
    }

    const ninjaName = document.getElementById("ninjaName").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        const res = await ninjaFetch(CONFIG.ENDPOINTS.REGISTER, {
            method: "POST",
            body: JSON.stringify({ ninjaName, email, password }),
        });

        if (!res) return;

        const data = await res.json();
        if (!res.ok) {
            alert(data.error || "Error al registrar.");
            return;
        }

        alert("✅ Registro exitoso. Entra al Dojo.");
        window.location.href = CONFIG.PAGES.LOGIN;
    } catch (err) {
        // Error manejado en api.js
    }
});