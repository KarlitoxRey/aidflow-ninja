// src/utils/economyRules.js

export const LEVEL_PRICES = {
    1: 10,  // $10 USD
    2: 20,  // $20 USD
    3: 50   // $50 USD
};

export const SPEED_MULTIPLIERS = {
    1: 1.0,
    2: 1.5,
    3: 2.0
};

// 🎟️ REGLA MEMORIZADA: 100 Fichas = $3 USD
// Valor unitario: $0.03
export const TOKEN_UNIT_VALUE = 0.03; 

// Cuántas fichas regalamos por nivel (Bonificación)
export const LEVEL_TOKENS = {
    1: 5,   // Valor real: $0.15
    2: 12,  // Valor real: $0.36
    3: 30   // Valor real: $0.90
};

// 📌 TABLA DE COMISIONES (Referidos)
export function calculateCommissions(referrerLevel, referralCount, amount) {
    let referrerPercent = 0.10; // Base Ronin

    // Nivel 1
    if (referrerLevel === 1) {
        if (referralCount >= 4) referrerPercent = 0.50;      
        else if (referralCount >= 2) referrerPercent = 0.45; 
        else referrerPercent = 0.40;                         
    }
    // Nivel 2
    else if (referrerLevel === 2) {
        if (referralCount >= 4) referrerPercent = 0.55;
        else if (referralCount >= 2) referrerPercent = 0.50;
        else referrerPercent = 0.45;
    }
    // Nivel 3
    else if (referrerLevel === 3) {
        if (referralCount >= 4) referrerPercent = 0.60;
        else if (referralCount >= 2) referrerPercent = 0.55;
        else referrerPercent = 0.50;
    }

    // 💰 Reparto
    const adminFeePercent = 0.20; // Tu 20%
    
    const adminShare = amount * adminFeePercent;
    let referrerShare = amount * referrerPercent;
    
    if (referrerLevel === 0) referrerShare = 0; // Sin nivel no cobra comisión alta

    // DAO = Total - Admin - Referente
    const daoShare = amount - adminShare - referrerShare; 

    return {
        adminShare,
        referrerShare,
        daoShare,
        referrerPercentUsed: referrerPercent
    };
}
