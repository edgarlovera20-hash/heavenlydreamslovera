export type ServiceSegment = "residencial" | "negocio";
export type ProductCategory = "infinitum_puro" | "doble_play";
export type ClientType = "linea_nueva" | "portado";

export interface PackageCatalogItem {
  id: string;
  segment: ServiceSegment;
  category: ProductCategory;
  allowedClientTypes: ClientType[];
  displayName: string;
  price: number;
  internetMbps: number;
  phoneLines?: number;
  includesClaroVideo: boolean;
  antivirus?: string;
  claroDrive?: string;
  mcAfeeExtra?: string;
  infinitumMail?: string;
  internetSecurity?: string;
  invoiceType?: string;
  webpageCost?: string;
  symmetry?: string;
  extrasIncluded?: string[];
  allowsStreamingChoice: boolean;
  streamingMonths?: number;
}

export const PACKAGE_CATALOG: PackageCatalogItem[] = [
  // 1. Infinitum Puro Negocio
  {
    id: "NEG_IP_120",
    segment: "negocio",
    category: "infinitum_puro",
    allowedClientTypes: ["linea_nueva"],
    displayName: "Infinitum Puro Negocio 120 Megas",
    price: 349,
    internetMbps: 120,
    includesClaroVideo: false,
    internetSecurity: "1 Dispositivo",
    allowsStreamingChoice: false
  },
  {
    id: "NEG_IP_150",
    segment: "negocio",
    category: "infinitum_puro",
    allowedClientTypes: ["linea_nueva"],
    displayName: "Infinitum Puro Negocio 150 Megas",
    price: 399,
    internetMbps: 150,
    includesClaroVideo: false,
    internetSecurity: "1 Dispositivo",
    allowsStreamingChoice: false
  },
  {
    id: "NEG_IP_250",
    segment: "negocio",
    category: "infinitum_puro",
    allowedClientTypes: ["linea_nueva"],
    displayName: "Infinitum Puro Negocio 250 Megas",
    price: 449,
    internetMbps: 250,
    includesClaroVideo: false,
    internetSecurity: "1 Dispositivo",
    allowsStreamingChoice: false
  },
  {
    id: "NEG_IP_350",
    segment: "negocio",
    category: "infinitum_puro",
    allowedClientTypes: ["linea_nueva"],
    displayName: "Infinitum Puro Negocio 350 Megas",
    price: 499,
    internetMbps: 350,
    includesClaroVideo: false,
    internetSecurity: "1 Dispositivo",
    allowsStreamingChoice: false
  },
  {
    id: "NEG_IP_500",
    segment: "negocio",
    category: "infinitum_puro",
    allowedClientTypes: ["linea_nueva"],
    displayName: "Infinitum Puro Negocio 500 Megas",
    price: 549,
    internetMbps: 500,
    includesClaroVideo: false,
    internetSecurity: "1 Dispositivo",
    allowsStreamingChoice: false
  },
  {
    id: "NEG_IP_600",
    segment: "negocio",
    category: "infinitum_puro",
    allowedClientTypes: ["linea_nueva"],
    displayName: "Infinitum Puro Negocio 600 Megas",
    price: 649,
    internetMbps: 600,
    includesClaroVideo: false,
    internetSecurity: "1 Dispositivo",
    allowsStreamingChoice: false
  },
  {
    id: "NEG_IP_850",
    segment: "negocio",
    category: "infinitum_puro",
    allowedClientTypes: ["linea_nueva"],
    displayName: "Infinitum Puro Negocio 850 Megas",
    price: 899,
    internetMbps: 850,
    includesClaroVideo: false,
    internetSecurity: "1 Dispositivo",
    allowsStreamingChoice: false
  },

  // 2. Infinitum Puro Residencial
  {
    id: "RES_IP_120",
    segment: "residencial",
    category: "infinitum_puro",
    allowedClientTypes: ["linea_nueva"],
    displayName: "Infinitum Puro Residencial 120 Megas",
    price: 349,
    internetMbps: 120,
    includesClaroVideo: true,
    antivirus: "1 Dispositivo",
    claroDrive: "100 GB",
    mcAfeeExtra: "3 Licencias",
    infinitumMail: "1 Cuenta",
    allowsStreamingChoice: false
  },
  {
    id: "RES_IP_150",
    segment: "residencial",
    category: "infinitum_puro",
    allowedClientTypes: ["linea_nueva"],
    displayName: "Infinitum Puro Residencial 150 Megas",
    price: 399,
    internetMbps: 150,
    includesClaroVideo: true,
    antivirus: "1 Dispositivo",
    claroDrive: "100 GB",
    mcAfeeExtra: "3 Licencias",
    infinitumMail: "1 Cuenta",
    allowsStreamingChoice: false
  },
  {
    id: "RES_IP_250",
    segment: "residencial",
    category: "infinitum_puro",
    allowedClientTypes: ["linea_nueva"],
    displayName: "Infinitum Puro Residencial 250 Megas",
    price: 449,
    internetMbps: 250,
    includesClaroVideo: true,
    antivirus: "1 Dispositivo",
    claroDrive: "200 GB",
    mcAfeeExtra: "3 Licencias",
    infinitumMail: "1 Cuenta",
    allowsStreamingChoice: false
  },
  {
    id: "RES_IP_350",
    segment: "residencial",
    category: "infinitum_puro",
    allowedClientTypes: ["linea_nueva"],
    displayName: "Infinitum Puro Residencial 350 Megas",
    price: 499,
    internetMbps: 350,
    includesClaroVideo: true,
    antivirus: "1 Dispositivo",
    claroDrive: "200 GB",
    mcAfeeExtra: "3 Licencias",
    infinitumMail: "1 Cuenta",
    allowsStreamingChoice: false
  },
  {
    id: "RES_IP_500",
    segment: "residencial",
    category: "infinitum_puro",
    allowedClientTypes: ["linea_nueva"],
    displayName: "Infinitum Puro Residencial 500 Megas",
    price: 549,
    internetMbps: 500,
    includesClaroVideo: true,
    antivirus: "1 Dispositivo",
    claroDrive: "200 GB",
    mcAfeeExtra: "3 Licencias",
    infinitumMail: "1 Cuenta",
    allowsStreamingChoice: false
  },
  {
    id: "RES_IP_600",
    segment: "residencial",
    category: "infinitum_puro",
    allowedClientTypes: ["linea_nueva"],
    displayName: "Infinitum Puro Residencial 600 Megas",
    price: 649,
    internetMbps: 600,
    includesClaroVideo: true,
    antivirus: "1 Dispositivo",
    claroDrive: "201 GB",
    mcAfeeExtra: "3 Licencias",
    infinitumMail: "1 Cuenta",
    allowsStreamingChoice: false
  },
  {
    id: "RES_IP_850",
    segment: "residencial",
    category: "infinitum_puro",
    allowedClientTypes: ["linea_nueva"],
    displayName: "Infinitum Puro Residencial 850 Megas",
    price: 899,
    internetMbps: 850,
    includesClaroVideo: true,
    antivirus: "1 Dispositivo",
    claroDrive: "400 GB",
    mcAfeeExtra: "3 Licencias",
    infinitumMail: "1 Cuenta",
    allowsStreamingChoice: false
  },

  // 3. Doble Play Negocio
  {
    id: "NEG_DP_120",
    segment: "negocio",
    category: "doble_play",
    allowedClientTypes: ["linea_nueva", "portado"],
    displayName: "Doble Play Negocio 120 Megas",
    price: 399,
    internetMbps: 120,
    phoneLines: 1,
    includesClaroVideo: false,
    invoiceType: "ADM",
    claroDrive: "1 Cuenta",
    webpageCost: "$99.00",
    symmetry: "Sin Costo",
    extrasIncluded: ["Sección Amarilla", "Email", "Seg. Internet"],
    allowsStreamingChoice: false
  },
  {
    id: "NEG_DP_250",
    segment: "negocio",
    category: "doble_play",
    allowedClientTypes: ["linea_nueva", "portado"],
    displayName: "Doble Play Negocio 250 Megas",
    price: 549,
    internetMbps: 250,
    phoneLines: 2,
    includesClaroVideo: false,
    invoiceType: "ADM",
    claroDrive: "1 Cuenta",
    webpageCost: "$99.00",
    symmetry: "Sin Costo",
    extrasIncluded: ["Sección Amarilla", "Email", "Seg. Internet"],
    allowsStreamingChoice: false
  },
  {
    id: "NEG_DP_350",
    segment: "negocio",
    category: "doble_play",
    allowedClientTypes: ["linea_nueva", "portado"],
    displayName: "Doble Play Negocio 350 Megas",
    price: 649,
    internetMbps: 350,
    phoneLines: 2,
    includesClaroVideo: false,
    invoiceType: "ADM",
    claroDrive: "1 Cuenta",
    webpageCost: "Sin Costo",
    symmetry: "Sin Costo",
    extrasIncluded: ["Sección Amarilla", "Email", "FB", "Google", "WA", "Seg."],
    allowsStreamingChoice: false
  },
  {
    id: "NEG_DP_500",
    segment: "negocio",
    category: "doble_play",
    allowedClientTypes: ["linea_nueva", "portado"],
    displayName: "Doble Play Negocio 500 Megas",
    price: 799,
    internetMbps: 500,
    phoneLines: 2,
    includesClaroVideo: false,
    invoiceType: "ADM",
    claroDrive: "1 Cuenta",
    webpageCost: "Sin Costo",
    symmetry: "Sin Costo",
    extrasIncluded: ["Sección Amarilla", "Email", "FB", "Google", "WA", "Seg."],
    allowsStreamingChoice: false
  },
  {
    id: "NEG_DP_600",
    segment: "negocio",
    category: "doble_play",
    allowedClientTypes: ["linea_nueva", "portado"],
    displayName: "Doble Play Negocio 600 Megas",
    price: 999,
    internetMbps: 600,
    phoneLines: 2,
    includesClaroVideo: false,
    invoiceType: "ADM",
    claroDrive: "1 Cuenta",
    webpageCost: "Sin Costo",
    symmetry: "Sin Costo",
    extrasIncluded: ["Sección Amarilla", "Email", "FB", "Google", "WA", "Seg."],
    allowsStreamingChoice: false
  },
  {
    id: "NEG_DP_850_2L",
    segment: "negocio",
    category: "doble_play",
    allowedClientTypes: ["linea_nueva", "portado"],
    displayName: "Doble Play Negocio 850 Megas 2 Líneas",
    price: 1499,
    internetMbps: 850,
    phoneLines: 2,
    includesClaroVideo: false,
    invoiceType: "ADM Básico",
    claroDrive: "1 Cuenta",
    webpageCost: "$400.00",
    symmetry: "Sin Costo",
    extrasIncluded: ["Sección Amarilla", "Email", "FB", "Google", "WA", "Seg."],
    allowsStreamingChoice: false
  },
  {
    id: "NEG_DP_850_4L",
    segment: "negocio",
    category: "doble_play",
    allowedClientTypes: ["linea_nueva", "portado"],
    displayName: "Doble Play Negocio 850 Megas 4 Líneas",
    price: 1789,
    internetMbps: 850,
    phoneLines: 4,
    includesClaroVideo: false,
    invoiceType: "ADM Básico",
    claroDrive: "1 Cuenta",
    webpageCost: "$450.00",
    symmetry: "Sin Costo",
    extrasIncluded: ["Sección Amarilla", "Email", "FB", "Google", "WA", "Seg."],
    allowsStreamingChoice: false
  },
  {
    id: "NEG_DP_1000_6L",
    segment: "negocio",
    category: "doble_play",
    allowedClientTypes: ["linea_nueva", "portado"],
    displayName: "Doble Play Negocio 1000 Megas 6 Líneas",
    price: 2289,
    internetMbps: 1000,
    phoneLines: 6,
    includesClaroVideo: false,
    invoiceType: "ADM Básico",
    claroDrive: "1 Cuenta",
    webpageCost: "$500.00",
    symmetry: "Sin Costo",
    extrasIncluded: ["Sección Amarilla", "Email", "FB", "Google", "WA", "Seg."],
    allowsStreamingChoice: false
  },

  // 4. Doble Play Residencial
  {
    id: "RES_DP_120",
    segment: "residencial",
    category: "doble_play",
    allowedClientTypes: ["linea_nueva", "portado"],
    displayName: "Doble Play Residencial 120 Megas",
    price: 389,
    internetMbps: 120,
    phoneLines: 1,
    includesClaroVideo: true,
    claroDrive: "100 GB",
    antivirus: "McAfee (3 lic)",
    infinitumMail: "Sin costo",
    allowsStreamingChoice: true,
    streamingMonths: 6
  },
  {
    id: "RES_DP_150",
    segment: "residencial",
    category: "doble_play",
    allowedClientTypes: ["linea_nueva", "portado"],
    displayName: "Doble Play Residencial 150 Megas",
    price: 435,
    internetMbps: 150,
    phoneLines: 1,
    includesClaroVideo: true,
    claroDrive: "100 GB",
    antivirus: "McAfee (3 lic)",
    infinitumMail: "Sin costo",
    allowsStreamingChoice: true,
    streamingMonths: 6
  },
  {
    id: "RES_DP_250",
    segment: "residencial",
    category: "doble_play",
    allowedClientTypes: ["linea_nueva", "portado"],
    displayName: "Doble Play Residencial 250 Megas",
    price: 499,
    internetMbps: 250,
    phoneLines: 1,
    includesClaroVideo: true,
    claroDrive: "200 GB",
    antivirus: "McAfee (3 lic)",
    infinitumMail: "Sin costo",
    allowsStreamingChoice: true,
    streamingMonths: 6
  },
  {
    id: "RES_DP_350",
    segment: "residencial",
    category: "doble_play",
    allowedClientTypes: ["linea_nueva", "portado"],
    displayName: "Doble Play Residencial 350 Megas",
    price: 599,
    internetMbps: 350,
    phoneLines: 2,
    includesClaroVideo: true,
    claroDrive: "200 GB",
    antivirus: "McAfee (3 lic)",
    infinitumMail: "Sin costo",
    allowsStreamingChoice: true,
    streamingMonths: 6
  },
  {
    id: "RES_DP_500",
    segment: "residencial",
    category: "doble_play",
    allowedClientTypes: ["linea_nueva", "portado"],
    displayName: "Doble Play Residencial 500 Megas",
    price: 649,
    internetMbps: 500,
    phoneLines: 2,
    includesClaroVideo: true,
    claroDrive: "200 GB",
    antivirus: "McAfee (3 lic)",
    infinitumMail: "Sin costo",
    allowsStreamingChoice: true,
    streamingMonths: 6
  },
  {
    id: "RES_DP_600",
    segment: "residencial",
    category: "doble_play",
    allowedClientTypes: ["linea_nueva", "portado"],
    displayName: "Doble Play Residencial 600 Megas",
    price: 725,
    internetMbps: 600,
    phoneLines: 2,
    includesClaroVideo: true,
    claroDrive: "200 GB",
    antivirus: "McAfee (3 lic)",
    infinitumMail: "Sin costo",
    allowsStreamingChoice: true,
    streamingMonths: 6
  },
  {
    id: "RES_DP_850",
    segment: "residencial",
    category: "doble_play",
    allowedClientTypes: ["linea_nueva", "portado"],
    displayName: "Doble Play Residencial 850 Megas",
    price: 999,
    internetMbps: 850,
    phoneLines: 3,
    includesClaroVideo: true,
    claroDrive: "400 GB",
    antivirus: "McAfee (3 lic)",
    infinitumMail: "Sin costo",
    allowsStreamingChoice: true,
    streamingMonths: 6
  },
  {
    id: "RES_DP_1000",
    segment: "residencial",
    category: "doble_play",
    allowedClientTypes: ["linea_nueva", "portado"],
    displayName: "Doble Play Residencial 1000 Megas",
    price: 1399,
    internetMbps: 1000,
    phoneLines: 6,
    includesClaroVideo: true,
    claroDrive: "400 GB",
    antivirus: "McAfee (3 lic)",
    infinitumMail: "Sin costo",
    allowsStreamingChoice: true,
    streamingMonths: 6
  }
];
