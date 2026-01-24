import { API_URL } from "./api.js";

/* =====================
    LOGIN SHOGUN READY
===================== */
const loginForm = document.getElementById("loginForm");

loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = loginForm.querySelector("input[type='email']").value;
    const password = loginForm.querySelector("input[type='password']").value;

    try {
        const res = await fetch(`${API_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json();
        
        if (!res.ok) {
            alert(`⚠️ ${data.error || "Falla en la identificación"}`);
            return;
        }

        // 🔐 PERSISTENCIA DE PODER
        // Limpiamos cualquier residuo previo antes de guardar
        localStorage.clear();
        
        localStorage.setItem("token", data.token);
        // Normalizamos a minúsculas para consistencia en todas las validaciones
        const userRole = data.user.role.toLowerCase();
        localStorage.setItem("role", userRole);
        localStorage.setItem("ninjaName", data.user.ninjaName);

        // Redirección inmediata según jerarquía
        if (userRole === 'shogun') {
            window.location.replace("admin.html");
        } else {
            window.location.replace("dashboard.html");
        }

    } catch (err) {
        alert("🚫 El templo no responde. Verificá tu conexión.");
    }
});

/* =====================
    REGISTER CON TÉRMINOS
===================== */
const registerForm = document.getElementById("registerForm");
registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const acceptTerms = document.getElementById("acceptTerms");
    if (!acceptTerms || !acceptTerms.checked) {
        alert("Debes aceptar el Código de Honor para unirte al Clan.");
        return;
    }

    const ninjaName = document.getElementById("ninjaName").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        const res = await fetch(`${API_URL}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ninjaName, email, password }),
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.error || "Error: Este Guerrero o Email ya están registrados.");
            return;
        }

        alert("✅ Registro exitoso. Identifícate para entrar al Dojo.");
        window.location.href = "login.html";
    } catch (err) { alert("🚫 Error al forjar la cuenta."); }
});