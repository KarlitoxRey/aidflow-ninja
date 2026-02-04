export const ECONOMY_RULES = {
    // 💰 PRECIOS (Sin cambios)
    ENTRY_COST: {
        LEVEL_1: 10,
        LEVEL_2: 25,
        LEVEL_3: 50,
        EARLY_BIRD_REENTRY: 8 
    },

    // 🏁 META DEL CICLO (El x3 que acordamos)
    CYCLE_GOAL: {
        LEVEL_1: 30,  
        LEVEL_2: 75,  
        LEVEL_3: 150  
    },

    // 💸 VALOR DEL SHURIKEN (MICROPAGO)
    MICROPAYMENT_VALUE: 0.25, 

    // 🏦 COSTOS FIJOS (Total 35%)
    FIXED_COSTS: {
        MAINTENANCE: 0.15, // 15% para el Admin
        DAO_BASE: 0.10,    // 10% para premios
        BACKUP: 0.10       // 10% Reserva de emergencia
    },

    // 🤝 SISTEMA DE REFERIDOS (Ajustado para seguridad)
    REFERRAL_TIERS: {
        // NIVEL 1: Referido se lleva entre 25% y 35%
        LEVEL_1: {
            BASE: 0.25, 
            BONUS: [
                { min: 0, max: 2, val: 0.00 }, // Total 25%
                { min: 2, max: 4, val: 0.05 }, // Total 30%
                { min: 4, max: 999, val: 0.10 } // Total 35%
            ]
        },
        // NIVEL 2: Referido se lleva entre 30% y 40%
        LEVEL_2: {
            BASE: 0.30, 
            BONUS: [
                { min: 0, max: 2, val: 0.00 }, // Total 30%
                { min: 2, max: 4, val: 0.05 }, // Total 35%
                { min: 4, max: 999, val: 0.10 } // Total 40%
            ]
        },
        // NIVEL 3: Referido se lleva entre 35% y 45%
        LEVEL_3: {
            BASE: 0.35,
            BONUS: [
                { min: 0, max: 2, val: 0.00 }, // Total 35%
                { min: 2, max: 4, val: 0.05 }, // Total 40%
                { min: 4, max: 999, val: 0.10 } // Total 45%
            ] 
        }
    }
};
