import type {
  PaintCreateFormData,
  ItemCreateFormData,
  ItemCategoryCreateFormData,
  ItemBrandCreateFormData,
  PaintTypeCreateFormData,
  PaintBrandCreateFormData,
  CustomerCreateFormData,
  SupplierCreateFormData,
} from "../schemas";
import type { PaintFormula } from "../types";
import { ITEM_CATEGORY_TYPE } from "../constants";

/**
 * Serializes form data to URL-safe parameters
 */
export function serializeFormToUrlParams(formData: Partial<PaintCreateFormData>, formulas?: PaintFormula[], currentStep?: number): URLSearchParams {
  const params = new URLSearchParams();

  // Add step if provided
  if (currentStep !== undefined) {
    params.set("step", currentStep.toString());
  }

  // Serialize basic form fields (only non-default values)
  if (formData.name && formData.name.trim()) params.set("name", formData.name);
  if (formData.hex && formData.hex !== "#000000") params.set("hex", formData.hex);
  if (formData.finish && formData.finish !== "SOLID") params.set("finish", formData.finish);
  if (formData.paintBrandId) params.set("paintBrandId", formData.paintBrandId);
  if (formData.manufacturer) params.set("manufacturer", formData.manufacturer);
  if (formData.paintTypeId && formData.paintTypeId.trim()) params.set("paintTypeId", formData.paintTypeId);
  if (formData.palette) params.set("palette", formData.palette);
  if (formData.paletteOrder !== undefined && formData.paletteOrder !== null && formData.paletteOrder !== "") {
    params.set("paletteOrder", formData.paletteOrder.toString());
  }

  // Serialize arrays
  if (formData.tags && formData.tags.length > 0) {
    params.set("tags", JSON.stringify(formData.tags));
  }
  if (formData.groundIds && formData.groundIds.length > 0) {
    params.set("groundIds", JSON.stringify(formData.groundIds));
  }

  // Serialize formulas if provided
  if (formulas && formulas.length > 0) {
    params.set("formulas", JSON.stringify(formulas));
  }

  return params;
}

/**
 * Deserializes URL parameters back to form data
 */
export function deserializeUrlParamsToForm(searchParams: URLSearchParams): {
  formData: Partial<PaintCreateFormData>;
  formulas: PaintFormula[];
  currentStep: number;
} {
  const formData: Partial<PaintCreateFormData> = {};
  let formulas: PaintFormula[] = [];
  let currentStep = 1;

  // Parse step
  const stepParam = searchParams.get("step");
  if (stepParam) {
    const parsedStep = parseInt(stepParam, 10);
    if (!isNaN(parsedStep) && parsedStep >= 1 && parsedStep <= 3) {
      currentStep = parsedStep;
    }
  }

  // Parse basic form fields
  const name = searchParams.get("name");
  if (name) formData.name = name;

  const hex = searchParams.get("hex");
  if (hex) formData.hex = hex;

  const finish = searchParams.get("finish");
  if (finish) formData.finish = finish as any;

  const paintBrandId = searchParams.get("paintBrandId");
  if (paintBrandId) formData.paintBrandId = paintBrandId;

  const manufacturer = searchParams.get("manufacturer");
  if (manufacturer) formData.manufacturer = manufacturer as any;

  const paintTypeId = searchParams.get("paintTypeId");
  if (paintTypeId) formData.paintTypeId = paintTypeId;

  const palette = searchParams.get("palette");
  if (palette) formData.palette = palette as any;

  const paletteOrder = searchParams.get("paletteOrder");
  if (paletteOrder) {
    const parsedOrder = parseInt(paletteOrder, 10);
    if (!isNaN(parsedOrder)) formData.paletteOrder = parsedOrder;
  }

  // Parse arrays
  try {
    const tagsParam = searchParams.get("tags");
    if (tagsParam) {
      const tags = JSON.parse(tagsParam);
      if (Array.isArray(tags)) formData.tags = tags;
    }
  } catch (error) {
    console.warn("Failed to parse tags from URL:", error);
  }

  try {
    const groundIdsParam = searchParams.get("groundIds");
    if (groundIdsParam) {
      const groundIds = JSON.parse(groundIdsParam);
      if (Array.isArray(groundIds)) formData.groundIds = groundIds;
    }
  } catch (error) {
    console.warn("Failed to parse groundIds from URL:", error);
  }

  // Parse formulas
  try {
    const formulasParam = searchParams.get("formulas");
    if (formulasParam) {
      const parsedFormulas = JSON.parse(formulasParam);
      if (Array.isArray(parsedFormulas)) formulas = parsedFormulas;
    }
  } catch (error) {
    console.warn("Failed to parse formulas from URL:", error);
  }

  return { formData, formulas, currentStep };
}

/**
 * Gets default form values with URL params merged
 */
export function getDefaultFormValues(searchParams: URLSearchParams, baseDefaults?: Partial<PaintCreateFormData>): PaintCreateFormData {
  const { formData: urlFormData } = deserializeUrlParamsToForm(searchParams);

  const defaults: PaintCreateFormData = {
    name: "",
    hex: "#000000",
    finish: "SOLID" as any,
    paintBrandId: null,
    manufacturer: null,
    tags: [],
    palette: undefined,
    paletteOrder: undefined,
    paintTypeId: "",
    groundIds: [],
    ...baseDefaults,
    ...urlFormData,
  };

  return defaults;
}

/**
 * Debounce function for URL updates
 */
export function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T & { cancel: () => void } {
  let timeout: NodeJS.Timeout;

  const debounced = ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;

  (debounced as any).cancel = () => {
    clearTimeout(timeout);
  };

  return debounced as T & { cancel: () => void };
}

// =====================
// Item Form URL State Management
// =====================

/**
 * Serializes item form data to URL-safe parameters
 */
export function serializeItemFormToUrlParams(formData: Partial<ItemCreateFormData>): URLSearchParams {
  const params = new URLSearchParams();

  // Serialize basic form fields (only non-default values)
  if (formData.name && formData.name.trim()) params.set("name", formData.name);
  if (formData.uniCode && formData.uniCode.trim()) params.set("uniCode", formData.uniCode);
  if (formData.quantity !== undefined && formData.quantity !== null && formData.quantity !== 0) params.set("quantity", formData.quantity.toString());
  if (formData.maxQuantity !== undefined && formData.maxQuantity !== null) params.set("maxQuantity", formData.maxQuantity.toString());
  if (formData.reorderPoint !== undefined && formData.reorderPoint !== null) params.set("reorderPoint", formData.reorderPoint.toString());
  if (formData.reorderQuantity !== undefined && formData.reorderQuantity !== null) params.set("reorderQuantity", formData.reorderQuantity.toString());
  if (formData.boxQuantity !== undefined && formData.boxQuantity !== null) params.set("boxQuantity", formData.boxQuantity.toString());
  if (formData.icms !== undefined && formData.icms !== null && formData.icms !== 0) params.set("icms", formData.icms.toString());
  if (formData.ipi !== undefined && formData.ipi !== null && formData.ipi !== 0) params.set("ipi", formData.ipi.toString());
  if (formData.monthlyConsumption !== undefined && formData.monthlyConsumption !== null && formData.monthlyConsumption !== 0) params.set("monthlyConsumption", formData.monthlyConsumption.toString());
  if (formData.estimatedLeadTime !== undefined && formData.estimatedLeadTime !== null && formData.estimatedLeadTime !== 30)
    params.set("estimatedLeadTime", formData.estimatedLeadTime.toString());
  if (formData.price !== undefined && formData.price !== null && formData.price !== "") params.set("price", formData.price.toString());

  // Boolean fields
  if (formData.shouldAssignToUser !== undefined && formData.shouldAssignToUser !== null && formData.shouldAssignToUser !== true) params.set("shouldAssignToUser", formData.shouldAssignToUser.toString());
  if (formData.isActive !== undefined && formData.isActive !== null && formData.isActive !== true) params.set("isActive", formData.isActive.toString());

  // Enum fields
  if (formData.abcCategory) params.set("abcCategory", formData.abcCategory);
  if (formData.xyzCategory) params.set("xyzCategory", formData.xyzCategory);
  if (formData.ppeType) params.set("ppeType", formData.ppeType);
  if (formData.ppeSize) params.set("ppeSize", formData.ppeSize);
  if (formData.ppeDeliveryMode) params.set("ppeDeliveryMode", formData.ppeDeliveryMode);

  // String IDs
  if (formData.brandId) params.set("brandId", formData.brandId);
  if (formData.categoryId) params.set("categoryId", formData.categoryId);
  if (formData.supplierId) params.set("supplierId", formData.supplierId);
  if (formData.ppeCA) params.set("ppeCA", formData.ppeCA);

  // Numeric PPE fields
  if (formData.ppeStandardQuantity !== undefined && formData.ppeStandardQuantity !== null) params.set("ppeStandardQuantity", formData.ppeStandardQuantity.toString());

  // Serialize arrays
  if (formData.barcodes && formData.barcodes.length > 0) {
    params.set("barcodes", JSON.stringify(formData.barcodes));
  }
  if (formData.measures && formData.measures.length > 0) {
    params.set("measures", JSON.stringify(formData.measures));
  }

  return params;
}

/**
 * Deserializes URL parameters back to item form data
 */
export function deserializeUrlParamsToItemForm(searchParams: URLSearchParams): Partial<ItemCreateFormData> {
  const formData: Partial<ItemCreateFormData> = {};

  // Parse basic form fields
  const name = searchParams.get("name");
  if (name) formData.name = name;

  const uniCode = searchParams.get("uniCode");
  if (uniCode) formData.uniCode = uniCode;

  const quantity = searchParams.get("quantity");
  if (quantity) {
    const parsedQuantity = parseFloat(quantity);
    if (!isNaN(parsedQuantity)) formData.quantity = parsedQuantity;
  }

  const maxQuantity = searchParams.get("maxQuantity");
  if (maxQuantity) {
    const parsed = parseFloat(maxQuantity);
    if (!isNaN(parsed)) formData.maxQuantity = parsed;
  }

  const reorderPoint = searchParams.get("reorderPoint");
  if (reorderPoint) {
    const parsed = parseFloat(reorderPoint);
    if (!isNaN(parsed)) formData.reorderPoint = parsed;
  }

  const reorderQuantity = searchParams.get("reorderQuantity");
  if (reorderQuantity) {
    const parsed = parseFloat(reorderQuantity);
    if (!isNaN(parsed)) formData.reorderQuantity = parsed;
  }

  const boxQuantity = searchParams.get("boxQuantity");
  if (boxQuantity) {
    const parsed = parseInt(boxQuantity, 10);
    if (!isNaN(parsed)) formData.boxQuantity = parsed;
  }

  const icms = searchParams.get("icms");
  if (icms) {
    const parsed = parseFloat(icms);
    if (!isNaN(parsed)) formData.icms = parsed;
  }

  const ipi = searchParams.get("ipi");
  if (ipi) {
    const parsed = parseFloat(ipi);
    if (!isNaN(parsed)) formData.ipi = parsed;
  }

  const monthlyConsumption = searchParams.get("monthlyConsumption");
  if (monthlyConsumption) {
    const parsed = parseFloat(monthlyConsumption);
    if (!isNaN(parsed)) formData.monthlyConsumption = parsed;
  }

  const estimatedLeadTime = searchParams.get("estimatedLeadTime");
  if (estimatedLeadTime) {
    const parsed = parseInt(estimatedLeadTime, 10);
    if (!isNaN(parsed)) formData.estimatedLeadTime = parsed;
  }

  const price = searchParams.get("price");
  if (price) {
    const parsed = parseFloat(price);
    if (!isNaN(parsed)) formData.price = parsed;
  }

  // Boolean fields
  const shouldAssignToUser = searchParams.get("shouldAssignToUser");
  if (shouldAssignToUser) formData.shouldAssignToUser = shouldAssignToUser === "true";

  const isActive = searchParams.get("isActive");
  if (isActive) formData.isActive = isActive === "true";

  // Enum fields
  const abcCategory = searchParams.get("abcCategory");
  if (abcCategory) formData.abcCategory = abcCategory as any;

  const xyzCategory = searchParams.get("xyzCategory");
  if (xyzCategory) formData.xyzCategory = xyzCategory as any;

  const ppeType = searchParams.get("ppeType");
  if (ppeType) formData.ppeType = ppeType as any;

  const ppeSize = searchParams.get("ppeSize");
  if (ppeSize) formData.ppeSize = ppeSize as any;

  const ppeDeliveryMode = searchParams.get("ppeDeliveryMode");
  if (ppeDeliveryMode) formData.ppeDeliveryMode = ppeDeliveryMode as any;

  // String IDs
  const brandId = searchParams.get("brandId");
  if (brandId) formData.brandId = brandId;

  const categoryId = searchParams.get("categoryId");
  if (categoryId) formData.categoryId = categoryId;

  const supplierId = searchParams.get("supplierId");
  if (supplierId) formData.supplierId = supplierId;

  const ppeCA = searchParams.get("ppeCA");
  if (ppeCA) formData.ppeCA = ppeCA;

  // Numeric PPE fields
  const ppeStandardQuantity = searchParams.get("ppeStandardQuantity");
  if (ppeStandardQuantity) {
    const parsed = parseInt(ppeStandardQuantity, 10);
    if (!isNaN(parsed)) formData.ppeStandardQuantity = parsed;
  }

  // Parse arrays
  try {
    const barcodesParam = searchParams.get("barcodes");
    if (barcodesParam) {
      const barcodes = JSON.parse(barcodesParam);
      if (Array.isArray(barcodes)) formData.barcodes = barcodes;
    }
  } catch (error) {
    console.warn("Failed to parse barcodes from URL:", error);
  }

  try {
    const measuresParam = searchParams.get("measures");
    if (measuresParam) {
      const measures = JSON.parse(measuresParam);
      if (Array.isArray(measures)) formData.measures = measures;
    }
  } catch (error) {
    console.warn("Failed to parse measures from URL:", error);
  }

  return formData;
}

/**
 * Gets default item form values with URL params merged
 */
export function getDefaultItemFormValues(searchParams: URLSearchParams, baseDefaults?: Partial<ItemCreateFormData>): ItemCreateFormData {
  const urlFormData = deserializeUrlParamsToItemForm(searchParams);

  const defaults: ItemCreateFormData = {
    name: "",
    uniCode: null,
    quantity: 0,
    reorderPoint: null,
    reorderQuantity: null,
    maxQuantity: null,
    boxQuantity: null,
    icms: undefined,
    ipi: undefined,
    measures: [],
    barcodes: [],
    shouldAssignToUser: true,
    abcCategory: null,
    xyzCategory: null,
    brandId: undefined,
    categoryId: undefined,
    supplierId: null,
    estimatedLeadTime: 30,
    isActive: true,
    price: undefined,
    monthlyConsumption: 0,
    // PPE fields
    ppeType: null,
    ppeSize: null,
    ppeCA: null,
    ppeDeliveryMode: null,
    ppeStandardQuantity: null,
    ...baseDefaults,
    ...urlFormData,
  };

  return defaults;
}

// =====================
// Item Category Form URL State Management
// =====================

/**
 * Serializes item category form data to URL-safe parameters
 */
export function serializeItemCategoryFormToUrlParams(formData: Partial<ItemCategoryCreateFormData>): URLSearchParams {
  const params = new URLSearchParams();

  // Serialize basic form fields (only non-default values)
  if (formData.name && formData.name.trim()) params.set("name", formData.name);

  // Type field - only set if different from default (REGULAR)
  if (formData.type !== undefined && formData.type !== ITEM_CATEGORY_TYPE.REGULAR) {
    params.set("type", formData.type);
  }

  // Serialize arrays
  if (formData.itemIds && formData.itemIds.length > 0) {
    params.set("itemIds", JSON.stringify(formData.itemIds));
  }

  return params;
}

/**
 * Deserializes URL parameters back to item category form data
 */
export function deserializeUrlParamsToItemCategoryForm(searchParams: URLSearchParams): Partial<ItemCategoryCreateFormData> {
  const formData: Partial<ItemCategoryCreateFormData> = {};

  // Parse basic form fields
  const name = searchParams.get("name");
  if (name) formData.name = name;

  // Type field
  const type = searchParams.get("type");
  if (type && Object.values(ITEM_CATEGORY_TYPE).includes(type as ITEM_CATEGORY_TYPE)) {
    formData.type = type as ITEM_CATEGORY_TYPE;
  }

  // Parse arrays
  try {
    const itemIdsParam = searchParams.get("itemIds");
    if (itemIdsParam) {
      const itemIds = JSON.parse(itemIdsParam);
      if (Array.isArray(itemIds)) formData.itemIds = itemIds;
    }
  } catch (error) {
    console.warn("Failed to parse itemIds from URL:", error);
  }

  return formData;
}

/**
 * Gets default item category form values with URL params merged
 */
export function getDefaultItemCategoryFormValues(searchParams: URLSearchParams, baseDefaults?: Partial<ItemCategoryCreateFormData>): ItemCategoryCreateFormData {
  const urlFormData = deserializeUrlParamsToItemCategoryForm(searchParams);

  const defaults: ItemCategoryCreateFormData = {
    name: "",
    type: ITEM_CATEGORY_TYPE.REGULAR,
    itemIds: [],
    ...baseDefaults,
    ...urlFormData,
  };

  return defaults;
}

// =====================
// Item Brand Form URL State Management
// =====================

/**
 * Serializes item brand form data to URL-safe parameters
 */
export function serializeItemBrandFormToUrlParams(formData: Partial<ItemBrandCreateFormData>): URLSearchParams {
  const params = new URLSearchParams();

  // Serialize basic form fields (only non-default values)
  if (formData.name && formData.name.trim()) params.set("name", formData.name);

  // Serialize arrays
  if (formData.itemIds && formData.itemIds.length > 0) {
    params.set("itemIds", JSON.stringify(formData.itemIds));
  }

  return params;
}

/**
 * Deserializes URL parameters back to item brand form data
 */
export function deserializeUrlParamsToItemBrandForm(searchParams: URLSearchParams): Partial<ItemBrandCreateFormData> {
  const formData: Partial<ItemBrandCreateFormData> = {};

  // Parse basic form fields
  const name = searchParams.get("name");
  if (name) formData.name = name;

  // Parse arrays
  try {
    const itemIdsParam = searchParams.get("itemIds");
    if (itemIdsParam) {
      const itemIds = JSON.parse(itemIdsParam);
      if (Array.isArray(itemIds)) formData.itemIds = itemIds;
    }
  } catch (error) {
    console.warn("Failed to parse itemIds from URL:", error);
  }

  return formData;
}

/**
 * Gets default item brand form values with URL params merged
 */
export function getDefaultItemBrandFormValues(searchParams: URLSearchParams, baseDefaults?: Partial<ItemBrandCreateFormData>): ItemBrandCreateFormData {
  const urlFormData = deserializeUrlParamsToItemBrandForm(searchParams);

  const defaults: ItemBrandCreateFormData = {
    name: "",
    itemIds: [],
    ...baseDefaults,
    ...urlFormData,
  };

  return defaults;
}

// =====================
// Paint Type Form URL State Management
// =====================

/**
 * Serializes paint type form data to URL-safe parameters
 */
export function serializePaintTypeFormToUrlParams(formData: Partial<PaintTypeCreateFormData>): URLSearchParams {
  const params = new URLSearchParams();

  // Serialize basic form fields (only non-default values)
  if (formData.name && formData.name.trim()) params.set("name", formData.name);

  // Boolean fields - only set if different from default (false)
  if (formData.needGround !== undefined && formData.needGround !== null && formData.needGround !== false) {
    params.set("needGround", formData.needGround.toString());
  }

  // Serialize arrays
  if (formData.componentItemIds && formData.componentItemIds.length > 0) {
    params.set("componentItemIds", JSON.stringify(formData.componentItemIds));
  }

  return params;
}

/**
 * Deserializes URL parameters back to paint type form data
 */
export function deserializeUrlParamsToPaintTypeForm(searchParams: URLSearchParams): Partial<PaintTypeCreateFormData> {
  const formData: Partial<PaintTypeCreateFormData> = {};

  // Parse basic form fields
  const name = searchParams.get("name");
  if (name) formData.name = name;

  // Boolean fields
  const needGround = searchParams.get("needGround");
  if (needGround) formData.needGround = needGround === "true";

  // Parse arrays
  try {
    const componentItemIdsParam = searchParams.get("componentItemIds");
    if (componentItemIdsParam) {
      const componentItemIds = JSON.parse(componentItemIdsParam);
      if (Array.isArray(componentItemIds)) formData.componentItemIds = componentItemIds;
    }
  } catch (error) {
    console.warn("Failed to parse componentItemIds from URL:", error);
  }

  return formData;
}

/**
 * Gets default paint type form values with URL params merged
 */
export function getDefaultPaintTypeFormValues(searchParams: URLSearchParams, baseDefaults?: Partial<PaintTypeCreateFormData>): PaintTypeCreateFormData {
  const urlFormData = deserializeUrlParamsToPaintTypeForm(searchParams);

  const defaults: PaintTypeCreateFormData = {
    name: "",
    needGround: false,
    componentItemIds: [],
    ...baseDefaults,
    ...urlFormData,
  };

  return defaults;
}

// =====================
// Paint Brand Form URL State Management
// =====================

/**
 * Serializes paint brand form data to URL-safe parameters
 */
export function serializePaintBrandFormToUrlParams(formData: Partial<PaintBrandCreateFormData>): URLSearchParams {
  const params = new URLSearchParams();

  // Serialize basic form fields (only non-default values)
  if (formData.name && formData.name.trim()) params.set("name", formData.name);

  // Serialize arrays
  if (formData.componentItemIds && formData.componentItemIds.length > 0) {
    params.set("componentItemIds", JSON.stringify(formData.componentItemIds));
  }

  return params;
}

/**
 * Deserializes URL parameters back to paint brand form data
 */
export function deserializeUrlParamsToPaintBrandForm(searchParams: URLSearchParams): Partial<PaintBrandCreateFormData> {
  const formData: Partial<PaintBrandCreateFormData> = {};

  const name = searchParams.get("name");
  if (name) formData.name = name;

  const componentItemIds = searchParams.get("componentItemIds");
  if (componentItemIds) {
    try {
      const parsed = JSON.parse(componentItemIds);
      if (Array.isArray(parsed)) formData.componentItemIds = parsed;
    } catch (e) {
      console.error("Failed to parse componentItemIds from URL:", e);
    }
  }

  return formData;
}

/**
 * Gets default paint brand form values with URL parameters applied
 */
export function getDefaultPaintBrandFormValues(searchParams: URLSearchParams, baseDefaults?: Partial<PaintBrandCreateFormData>): PaintBrandCreateFormData {
  const urlFormData = deserializeUrlParamsToPaintBrandForm(searchParams);

  const defaults: PaintBrandCreateFormData = {
    name: "",
    componentItemIds: [],
    ...baseDefaults,
    ...urlFormData,
  };

  return defaults;
}

// =====================
// Customer Form URL State Management
// =====================

/**
 * Serializes customer form data to URL-safe parameters
 */
export function serializeCustomerFormToUrlParams(formData: Partial<CustomerCreateFormData>): URLSearchParams {
  const params = new URLSearchParams();

  // Serialize basic form fields (only non-default values)
  if (formData.fantasyName && formData.fantasyName.trim()) params.set("fantasyName", formData.fantasyName);
  if (formData.corporateName && formData.corporateName.trim()) params.set("corporateName", formData.corporateName);
  if (formData.cpf && formData.cpf.trim()) params.set("cpf", formData.cpf);
  if (formData.cnpj && formData.cnpj.trim()) params.set("cnpj", formData.cnpj);
  if (formData.email && formData.email.trim()) params.set("email", formData.email);
  if (formData.site && formData.site.trim()) params.set("site", formData.site);

  // Address fields
  if (formData.address && formData.address.trim()) params.set("address", formData.address);
  if (formData.addressNumber && formData.addressNumber.trim()) params.set("addressNumber", formData.addressNumber);
  if (formData.addressComplement && formData.addressComplement.trim()) params.set("addressComplement", formData.addressComplement);
  if (formData.neighborhood && formData.neighborhood.trim()) params.set("neighborhood", formData.neighborhood);
  if (formData.city && formData.city.trim()) params.set("city", formData.city);
  if (formData.state && formData.state.trim()) params.set("state", formData.state);
  if (formData.zipCode && formData.zipCode.trim()) params.set("zipCode", formData.zipCode);

  // File ID
  if (formData.logoId && formData.logoId.trim()) params.set("logoId", formData.logoId);

  // Registration Status
  if (formData.registrationStatus && formData.registrationStatus.trim()) params.set("registrationStatus", formData.registrationStatus);

  // Serialize arrays
  if (formData.phones && formData.phones.length > 0) {
    params.set("phones", JSON.stringify(formData.phones));
  }
  if (formData.tags && formData.tags.length > 0) {
    params.set("tags", JSON.stringify(formData.tags));
  }

  return params;
}

/**
 * Deserializes URL parameters back to customer form data
 */
export function deserializeUrlParamsToCustomerForm(searchParams: URLSearchParams): Partial<CustomerCreateFormData> {
  const formData: Partial<CustomerCreateFormData> = {};

  // Parse basic form fields
  const fantasyName = searchParams.get("fantasyName");
  if (fantasyName) formData.fantasyName = fantasyName;

  const corporateName = searchParams.get("corporateName");
  if (corporateName) formData.corporateName = corporateName;

  const cpf = searchParams.get("cpf");
  if (cpf) formData.cpf = cpf;

  const cnpj = searchParams.get("cnpj");
  if (cnpj) formData.cnpj = cnpj;

  const email = searchParams.get("email");
  if (email) formData.email = email;

  const site = searchParams.get("site");
  if (site) formData.site = site;

  // Address fields
  const address = searchParams.get("address");
  if (address) formData.address = address;

  const addressNumber = searchParams.get("addressNumber");
  if (addressNumber) formData.addressNumber = addressNumber;

  const addressComplement = searchParams.get("addressComplement");
  if (addressComplement) formData.addressComplement = addressComplement;

  const neighborhood = searchParams.get("neighborhood");
  if (neighborhood) formData.neighborhood = neighborhood;

  const city = searchParams.get("city");
  if (city) formData.city = city;

  const state = searchParams.get("state");
  if (state) formData.state = state;

  const zipCode = searchParams.get("zipCode");
  if (zipCode) formData.zipCode = zipCode;

  const logoId = searchParams.get("logoId");
  if (logoId) formData.logoId = logoId;

  const registrationStatus = searchParams.get("registrationStatus");
  if (registrationStatus) formData.registrationStatus = registrationStatus;

  // Parse arrays
  try {
    const phonesParam = searchParams.get("phones");
    if (phonesParam) {
      const phones = JSON.parse(phonesParam);
      if (Array.isArray(phones)) formData.phones = phones;
    }
  } catch (error) {
    console.warn("Failed to parse phones from URL:", error);
  }

  try {
    const tagsParam = searchParams.get("tags");
    if (tagsParam) {
      const tags = JSON.parse(tagsParam);
      if (Array.isArray(tags)) formData.tags = tags;
    }
  } catch (error) {
    console.warn("Failed to parse tags from URL:", error);
  }

  return formData;
}

/**
 * Gets default customer form values with URL params merged
 */
export function getDefaultCustomerFormValues(searchParams: URLSearchParams, baseDefaults?: Partial<CustomerCreateFormData>): CustomerCreateFormData {
  const urlFormData = deserializeUrlParamsToCustomerForm(searchParams);

  const defaults: CustomerCreateFormData = {
    fantasyName: "",
    cnpj: null,
    cpf: null,
    corporateName: null,
    email: null,
    address: null,
    addressNumber: null,
    addressComplement: null,
    neighborhood: null,
    city: null,
    state: null,
    zipCode: null,
    site: null,
    phones: [],
    tags: [],
    logoId: null,
    ...baseDefaults,
    ...urlFormData,
  };

  return defaults;
}

// =====================
// Supplier Form URL State Management
// =====================

/**
 * Serializes supplier form data to URL-safe parameters
 */
export function serializeSupplierFormToUrlParams(formData: Partial<SupplierCreateFormData>): URLSearchParams {
  const params = new URLSearchParams();

  // Serialize basic form fields (only non-default values)
  if (formData.fantasyName && formData.fantasyName.trim()) params.set("fantasyName", formData.fantasyName);
  if (formData.corporateName && formData.corporateName.trim()) params.set("corporateName", formData.corporateName);
  if (formData.cnpj && formData.cnpj.trim()) params.set("cnpj", formData.cnpj);
  if (formData.email && formData.email.trim()) params.set("email", formData.email);
  if (formData.site && formData.site.trim()) params.set("site", formData.site);

  // Address fields
  if (formData.address && formData.address.trim()) params.set("address", formData.address);
  if (formData.addressNumber && formData.addressNumber.trim()) params.set("addressNumber", formData.addressNumber);
  if (formData.addressComplement && formData.addressComplement.trim()) params.set("addressComplement", formData.addressComplement);
  if (formData.neighborhood && formData.neighborhood.trim()) params.set("neighborhood", formData.neighborhood);
  if (formData.city && formData.city.trim()) params.set("city", formData.city);
  if (formData.state && formData.state.trim()) params.set("state", formData.state);
  if (formData.zipCode && formData.zipCode.trim()) params.set("zipCode", formData.zipCode);

  // File ID
  if (formData.logoId && formData.logoId.trim()) params.set("logoId", formData.logoId);

  // Serialize arrays
  if (formData.phones && formData.phones.length > 0) {
    params.set("phones", JSON.stringify(formData.phones));
  }
  if (formData.tags && formData.tags.length > 0) {
    params.set("tags", JSON.stringify(formData.tags));
  }

  return params;
}

/**
 * Deserializes URL parameters back to supplier form data
 */
export function deserializeUrlParamsToSupplierForm(searchParams: URLSearchParams): Partial<SupplierCreateFormData> {
  const formData: Partial<SupplierCreateFormData> = {};

  // Parse basic form fields
  const fantasyName = searchParams.get("fantasyName");
  if (fantasyName) formData.fantasyName = fantasyName;

  const corporateName = searchParams.get("corporateName");
  if (corporateName) formData.corporateName = corporateName;

  const cnpj = searchParams.get("cnpj");
  if (cnpj) formData.cnpj = cnpj;

  const email = searchParams.get("email");
  if (email) formData.email = email;

  const site = searchParams.get("site");
  if (site) formData.site = site;

  // Address fields
  const address = searchParams.get("address");
  if (address) formData.address = address;

  const addressNumber = searchParams.get("addressNumber");
  if (addressNumber) formData.addressNumber = addressNumber;

  const addressComplement = searchParams.get("addressComplement");
  if (addressComplement) formData.addressComplement = addressComplement;

  const neighborhood = searchParams.get("neighborhood");
  if (neighborhood) formData.neighborhood = neighborhood;

  const city = searchParams.get("city");
  if (city) formData.city = city;

  const state = searchParams.get("state");
  if (state) formData.state = state;

  const zipCode = searchParams.get("zipCode");
  if (zipCode) formData.zipCode = zipCode;

  const logoId = searchParams.get("logoId");
  if (logoId) formData.logoId = logoId;

  const registrationStatus = searchParams.get("registrationStatus");
  if (registrationStatus) formData.registrationStatus = registrationStatus;

  // Parse arrays
  try {
    const phonesParam = searchParams.get("phones");
    if (phonesParam) {
      const phones = JSON.parse(phonesParam);
      if (Array.isArray(phones)) formData.phones = phones;
    }
  } catch (error) {
    console.warn("Failed to parse phones from URL:", error);
  }

  try {
    const tagsParam = searchParams.get("tags");
    if (tagsParam) {
      const tags = JSON.parse(tagsParam);
      if (Array.isArray(tags)) formData.tags = tags;
    }
  } catch (error) {
    console.warn("Failed to parse tags from URL:", error);
  }

  return formData;
}

/**
 * Gets default supplier form values with URL params merged
 */
export function getDefaultSupplierFormValues(searchParams: URLSearchParams, baseDefaults?: Partial<SupplierCreateFormData>): SupplierCreateFormData {
  const urlFormData = deserializeUrlParamsToSupplierForm(searchParams);

  const defaults: SupplierCreateFormData = {
    fantasyName: "",
    cnpj: null,
    corporateName: null,
    email: null,
    address: null,
    addressNumber: null,
    addressComplement: null,
    neighborhood: null,
    city: null,
    state: null,
    zipCode: null,
    site: null,
    phones: [],
    tags: [],
    logoId: null,
    ...baseDefaults,
    ...urlFormData,
  };

  return defaults;
}
