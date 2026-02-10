export const ECONOMY = {
    // === COSTOS Y METAS ===
    LEVELS: {
        1: { COST: 10, GOAL: 30,  NEXT_UNLOCK: 2 },
        2: { COST: 25, GOAL: 75,  NEXT_UNLOCK: 3 },
        3: { COST: 50, GOAL: 150, NEXT_UNLOCK: 3 } // Tope
    },

    // === DISTRIBUCIÓN NIVEL 1 ($10) ===
    // Caso A: Usuario Nuevo SIN Referido
    L1_NO_REF: {
        BACKUP: 0.20, // $2
        MAINT:  0.20, // $2
        DAO:    0.20, // $2
        MICRO:  0.40  // $4 (Lluvia)
    },
    // Caso B: Usuario Nuevo CON Referido (La comisión del ref varía, el resto se ajusta)
    L1_WITH_REF: {
        DAO_FEE:   0.20, // Fijo 20%
        MAINT_FEE: 0.10, // Fijo 10% (Nivel 1 y 2) - Ojo: Nivel 3 es 20% Maint
        // El resto va a Micropagos
    },

    // === DISTRIBUCIÓN NIVEL 2 ($25) ===
    L2_DIST: {
        MAINT:  5,
        BACKUP: 5,
        DAO:    5,
        MICRO:  10
    },

    // === DISTRIBUCIÓN NIVEL 3 ($50) ===
    L3_DIST: {
        MAINT:  10,
        BACKUP: 10,
        DAO:    10,
        MICRO:  20
    },

    // === SISTEMA DE REFERIDOS (COMISIONES POR $10 DE ENTRADA) ===
    REFERRAL_TIERS: {
        LEVEL_1: { 
            BASE: 0.40, // 0-2 refs
            MID:  0.45, // 2-4 refs
            TOP:  0.50, // 4+ refs
            SPEED: 1
        },
        LEVEL_2: { 
            BASE: 0.45, 
            MID:  0.50, 
            TOP:  0.55,
            SPEED: 1.5
        },
        LEVEL_3: { 
            BASE: 0.50, 
            MID:  0.55, 
            TOP:  0.60,
            SPEED: 2
        }
    },

    MICROPAYMENT_CHUNK: 0.25 // Valor de cada gota de lluvia
};
