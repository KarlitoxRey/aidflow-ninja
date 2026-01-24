// 🥷 Manejo de la Interfaz Ninja
export function mostrarTerminos() {
    const ventanaTerminos = window.open("terminos.html", "CodigoDeHonor", "width=600,height=700");
    if (!ventanaTerminos) {
        alert("📜 CÓDIGO DE HONOR NINJA:\n\n1. Naturaleza: Ayuda mutua gamificada. NO es inversión.\n2. Responsabilidad: Participación voluntaria sin garantías.\n3. Lealtad: Una cuenta por persona.\n\nRevisá el archivo terminos.html para el detalle completo.");
    }
}