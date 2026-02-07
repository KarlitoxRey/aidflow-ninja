export const ECONOMY_RULES = {
    // Costo de Entrada (Pases)
    ENTRY_COST: {
        LEVEL_1: 10,
        LEVEL_2: 25,
        LEVEL_3: 50
    },

    // Distribución de Costos Fijos (Sumados deben ser menor al 100%)
    FIXED_COSTS: {
        MAINTENANCE: 0.10, // 10% para el Admin (Shogun)
        DAO_BASE: 0.05,    // 5% para el DAO inicial
        BACKUP: 0.05       // 5% para Respaldo
    },

    // Sistema de Referidos (Comisiones por nivel)
    REFERRAL_TIERS: {
        LEVEL_1: { BASE: 0.10 }, // 10% al patrocinador directo
        LEVEL_2: { BASE: 0.15 },
        LEVEL_3: { BASE: 0.20 }
    },

    // Metas del Ciclo (Para poder retirar)
    CYCLE_GOAL: {
        LEVEL_1: 30.00,
        LEVEL_2: 75.00,
        LEVEL_3: 150.00
    },

    // Valor del Micropago (Lluvia de dinero)
    MICROPAYMENT_VALUE: 0.25
};
