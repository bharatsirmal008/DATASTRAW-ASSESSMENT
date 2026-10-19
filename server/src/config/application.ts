/** Explicit assessment mode uses the PDF's fictional brand and supplied orders. */
export function isAssessmentMode(): boolean {
  return process.env.APP_MODE === 'assessment';
}

export function supportBrandName(): string {
  return isAssessmentMode() ? 'Aura Skincare' : process.env.SUPPORT_BRAND_NAME?.trim() || 'Aura Skincare';
}
