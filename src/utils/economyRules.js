// src/utils/economyRules.js

export const LEVEL_PRICES = {
    1: 10,  // Nivel 1 ($10)
    2: 20,  // Nivel 2 ($20)
    3: 50   // Nivel 3 ($50)
};

export const SPEED_MULTIPLIERS = {
    1: 1.0,
    2: 1.5,
    3: 2.0
};

// 📌 TU TABLA MAESTRA DE COMISIONES
export function calculateCommissions(referrerLevel, referralCount, amount) {
    let referrerPercent = 0.10; // Base por defecto si es Ronin

    // Lógica Nivel 1 (Base 40%)
    if (referrerLevel === 1) {
        if (referralCount >= 4) referrerPercent = 0.50;      
        else if (referralCount >= 2) referrerPercent = 0.45; 
        else referrerPercent = 0.40;                         
    }
    // Lógica Nivel 2 (Base 45%)
    else if (referrerLevel === 2) {
        if (referralCount >= 4) referrerPercent = 0.55;
        else if (referralCount >= 2) referrerPercent = 0.50;
        else referrerPercent = 0.45;
    }
    // Lógica Nivel 3 (Base 50%)
    else if (referrerLevel === 3) {
        if (referralCount >= 4) referrerPercent = 0.60;
        else if (referralCount >= 2) referrerPercent = 0.55;
        else referrerPercent = 0.50;
    }

    // 💰 Reparto
    const adminFeePercent = 0.20; // 20% Mantenimiento (Para vos)
    
    const adminShare = amount * adminFeePercent;
    let referrerShare = amount * referrerPercent;
    
    // Si el usuario no tiene referente, todo el % de referente se va al DAO
    if (referrerLevel === 0) referrerShare = 0;

    // El DAO se lleva el resto
    const daoShare = amount - adminShare - referrerShare; 

    return {
        adminShare,
        referrerShare,
        daoShare,
        referrerPercentUsed: referrerPercent
    };
}
