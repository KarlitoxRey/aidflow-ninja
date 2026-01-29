// utils/economyRules.js

export const LEVEL_PRICES = {
    1: 10,  // $10
    2: 20,  // $20
    3: 50   // $50
};

export const SPEED_MULTIPLIERS = {
    1: 1.0,
    2: 1.5,
    3: 2.0
};

// 📌 TU TABLA DE COMISIONES OFICIAL
export function calculateCommissions(level, referralCount, amount) {
    let referrerPercent = 0.40; // Base 40%

    // Lógica Nivel 1 (Base 40%)
    if (level === 1) {
        if (referralCount >= 4) referrerPercent = 0.50;      // +4 refs
        else if (referralCount >= 2) referrerPercent = 0.45; // 2-4 refs
        else referrerPercent = 0.40;                         // 0-2 refs
    }
    // Lógica Nivel 2 (Base 45%)
    else if (level === 2) {
        if (referralCount >= 4) referrerPercent = 0.55;
        else if (referralCount >= 2) referrerPercent = 0.50;
        else referrerPercent = 0.45;
    }
    // Lógica Nivel 3 (Base 50%)
    else if (level === 3) {
        if (referralCount >= 4) referrerPercent = 0.60;
        else if (referralCount >= 2) referrerPercent = 0.55;
        else referrerPercent = 0.50;
    }

    // 💰 Reparto
    const adminFee = 0.20; // 20% Mantenimiento (Para vos)
    
    const adminShare = amount * adminFee;
    const referrerShare = amount * referrerPercent;
    
    // El DAO se lleva lo que sobra: Total - Admin - Referente
    const daoShare = amount - adminShare - referrerShare; 

    return {
        adminShare,
        referrerShare,
        daoShare,
        referrerPercentUsed: referrerPercent
    };
}
