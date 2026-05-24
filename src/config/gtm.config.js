/**
 * AdAnalyzer — gtm.config.js
 * Mapeamento de containers GTM → Meta Pixel → GA4
 * Para adicionar nova loja: inclua um novo objeto neste array.
 * ga4MeasurementId: rode GET /api/google/gtm/streams para descobrir os G-XXXXXXXX
 */

module.exports = [
  {
    gtmPublicId:      "GTM-MJBJN9LK",
    name:             "Loja Gonzaga",
    pixelId:          "1278522661018213",
    ga4MeasurementId: null, // preencher após /api/google/gtm/streams
  },
  {
    gtmPublicId:      "GTM-KT8TPS54",
    name:             "Multi Lojas Target",
    pixelId:          "1448034903428693",
    ga4MeasurementId: null,
  },
  {
    gtmPublicId:      "GTM-PFRPPN54",
    name:             "Campanha da Família",
    pixelId:          "885592201152866",
    ga4MeasurementId: null,
  },
  {
    gtmPublicId:      "GTM-W5BF6TDL",
    name:             "Target / TGT Santos",
    pixelId:          "987203723903257",
    ga4MeasurementId: null,
  },
  {
    gtmPublicId:      "GTM-KSN4CRL7",
    name:             "Pitangueiras TGT",
    pixelId:          "987203723903257",
    ga4MeasurementId: null,
  },
  {
    gtmPublicId:      "GTM-NNNR73NZ",
    name:             "Enseada TGT",
    pixelId:          "987203723903257",
    ga4MeasurementId: null,
  },
  {
    gtmPublicId:      "GTM-W7HTH83L",
    name:             "Promo Óculos de Sol TGT",
    pixelId:          "885592201152866",
    ga4MeasurementId: null,
  },
];
