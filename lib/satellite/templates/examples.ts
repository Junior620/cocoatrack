/**
 * Report Template Usage Examples
 * 
 * This file demonstrates various ways to use report templates
 * for generating EUDR compliance certification reports.
 */

import {
  createDefaultTemplate,
  createCustomTemplate,
  getTemplatePreset,
  type ReportTemplate,
} from './report-templates';

/**
 * Example 1: Basic usage with default template
 * 
 * Use the default CocoaTrack template with green branding
 */
export function example1_DefaultTemplate(): ReportTemplate {
  // Create default French template
  const template = createDefaultTemplate('fr');
  
  return template;
}

/**
 * Example 2: English template for international reports
 * 
 * Use default template but with English language
 */
export function example2_EnglishTemplate(): ReportTemplate {
  const template = createDefaultTemplate('en');
  
  return template;
}

/**
 * Example 3: Custom branding for a cooperative
 * 
 * Create a template with custom cooperative branding
 */
export function example3_CooperativeBranding(): ReportTemplate {
  const template = createCustomTemplate(
    'fr',
    {
      companyName: 'Coopérative du Sud Cameroun',
      tagline: 'Cacao Durable et Équitable',
      email: 'contact@coopdusud.cm',
      phone: '+237 XXX XXX XXX',
      website: 'www.coopdusud.cm',
    }
  );
  
  return template;
}

/**
 * Example 4: Custom color scheme
 * 
 * Create a template with custom brand colors
 */
export function example4_CustomColors(): ReportTemplate {
  const template = createCustomTemplate(
    'fr',
    {
      companyName: 'Coopérative Verte',
    },
    {
      primary: '#1a5f3d',    // Custom dark green
      secondary: '#4ade80',  // Custom light green
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#dc2626',
    }
  );
  
  return template;
}

/**
 * Example 5: Professional blue theme
 * 
 * Use the professional preset for formal reports
 */
export function example5_ProfessionalTheme(): ReportTemplate {
  const template = getTemplatePreset('professional');
  
  return template;
}

/**
 * Example 6: High contrast for accessibility
 * 
 * Use high contrast theme for better readability
 */
export function example6_HighContrast(): ReportTemplate {
  const template = getTemplatePreset('highContrast');
  
  return template;
}

/**
 * Example 7: Fully customized template
 * 
 * Create a template with all custom options
 */
export function example7_FullyCustomized(): ReportTemplate {
  const template = createCustomTemplate(
    'en',
    {
      companyName: 'Global Cocoa Certification',
      tagline: 'Certified Sustainable Cocoa',
      email: 'certification@globalcocoa.org',
      website: 'www.globalcocoa.org',
      phone: '+1 XXX XXX XXXX',
    },
    {
      primary: '#0f766e',
      secondary: '#14b8a6',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#dc2626',
      text: '#111827',
      textLight: '#6b7280',
      background: '#ffffff',
      border: '#d1d5db',
    },
    {
      heading: 'helvetica',
      body: 'times',
      mono: 'courier',
    },
    {
      pageMargin: 25,
      sectionSpacing: 12,
      headerHeight: 45,
      footerHeight: 18,
    }
  );
  
  return template;
}

/**
 * Example 8: Dynamic template selection based on user preference
 * 
 * Select template based on user or cooperative settings
 */
export function example8_DynamicSelection(
  userPreference: 'default' | 'professional' | 'minimalist' | 'highContrast',
  language: 'fr' | 'en'
): ReportTemplate {
  // Get preset template
  const baseTemplate = getTemplatePreset(userPreference);
  
  // Override language if needed
  if (baseTemplate.language !== language) {
    return createCustomTemplate(
      language,
      baseTemplate.branding,
      baseTemplate.colors,
      baseTemplate.fonts,
      baseTemplate.layout
    );
  }
  
  return baseTemplate;
}

/**
 * Example 9: Template for specific cooperative from database
 * 
 * This example shows how you might load cooperative-specific
 * branding from a database and create a custom template
 */
export function example9_CooperativeFromDatabase(
  cooperativeData: {
    name: string;
    email?: string;
    phone?: string;
    website?: string;
    primaryColor?: string;
    secondaryColor?: string;
    language: 'fr' | 'en';
  }
): ReportTemplate {
  return createCustomTemplate(
    cooperativeData.language,
    {
      companyName: cooperativeData.name,
      email: cooperativeData.email,
      phone: cooperativeData.phone,
      website: cooperativeData.website,
    },
    cooperativeData.primaryColor || cooperativeData.secondaryColor
      ? {
          primary: cooperativeData.primaryColor || '#2d5016',
          secondary: cooperativeData.secondaryColor || '#6FAF3D',
        }
      : undefined
  );
}

/**
 * Example 10: Template with custom layout for compact reports
 * 
 * Create a template with reduced margins for more compact reports
 */
export function example10_CompactLayout(): ReportTemplate {
  const template = createCustomTemplate(
    'fr',
    undefined,
    undefined,
    undefined,
    {
      pageMargin: 15,        // Reduced from 20
      sectionSpacing: 8,     // Reduced from 10
      headerHeight: 35,      // Reduced from 40
      footerHeight: 12,      // Reduced from 15
    }
  );
  
  return template;
}

/**
 * Example 11: Multi-language report generation
 * 
 * Generate reports in multiple languages with the same branding
 */
export function example11_MultiLanguage(
  branding: {
    companyName: string;
    email?: string;
  }
): { fr: ReportTemplate; en: ReportTemplate } {
  const frenchTemplate = createCustomTemplate('fr', branding);
  const englishTemplate = createCustomTemplate('en', branding);
  
  return {
    fr: frenchTemplate,
    en: englishTemplate,
  };
}

/**
 * Example 12: Template selection helper function
 * 
 * Helper function to select appropriate template based on context
 */
export function selectTemplate(context: {
  language: 'fr' | 'en';
  isInternational?: boolean;
  isAccessibility?: boolean;
  cooperativeBranding?: {
    name: string;
    email?: string;
    primaryColor?: string;
  };
}): ReportTemplate {
  // High contrast for accessibility
  if (context.isAccessibility) {
    const template = getTemplatePreset('highContrast');
    if (template.language !== context.language) {
      return createCustomTemplate(
        context.language,
        template.branding,
        template.colors
      );
    }
    return template;
  }
  
  // Professional theme for international reports
  if (context.isInternational) {
    const template = getTemplatePreset('professional');
    if (template.language !== context.language) {
      return createCustomTemplate(
        context.language,
        template.branding,
        template.colors
      );
    }
    return template;
  }
  
  // Custom cooperative branding if provided
  if (context.cooperativeBranding) {
    return createCustomTemplate(
      context.language,
      {
        companyName: context.cooperativeBranding.name,
        email: context.cooperativeBranding.email,
      },
      context.cooperativeBranding.primaryColor
        ? { primary: context.cooperativeBranding.primaryColor }
        : undefined
    );
  }
  
  // Default template
  return createDefaultTemplate(context.language);
}

/**
 * Example usage in report generation
 * 
 * This shows how to use templates with the export service
 */
export async function exampleUsageInReportGeneration() {
  // This is a conceptual example - actual implementation would import exportService
  
  // Example 1: Basic report with default template
  const template1 = createDefaultTemplate('fr');
  // await exportService.generateCertificationReport(data, options, template1);
  
  // Example 2: Report with cooperative branding
  const template2 = createCustomTemplate(
    'fr',
    {
      companyName: 'Ma Coopérative',
      email: 'contact@macoop.cm',
    },
    {
      primary: '#1a5f3d',
    }
  );
  // await exportService.generateCertificationReport(data, options, template2);
  
  // Example 3: Professional report for international auditor
  const template3 = getTemplatePreset('professional');
  // await exportService.generateCertificationReport(data, options, template3);
  
  // Example 4: Dynamic template selection
  const template4 = selectTemplate({
    language: 'en',
    isInternational: true,
  });
  // await exportService.generateCertificationReport(data, options, template4);
}
