/**
 * Receipt Parser Service Tests
 * 
 * Unit tests for receipt parsing functions
 * Requirements: 14.1-14.12
 */

import { ReceiptParser } from '../receipt-parser';

describe('ReceiptParser', () => {
  let parser: ReceiptParser;

  beforeEach(() => {
    parser = new ReceiptParser();
  });

  describe('extractContractNumber', () => {
    it('should extract contract number with standard format', () => {
      const text = 'N°CONT.M041912772280M-CM/DLA/03/2025/00320';
      const result = parser.extractContractNumber(text);
      expect(result).toBe('M041912772280M-CM/DLA/03/2025/00320');
    });

    it('should extract contract number with spaces', () => {
      const text = 'N° CONT.M041912772280M-CM/DLA/03/2025/00320';
      const result = parser.extractContractNumber(text);
      expect(result).toBe('M041912772280M-CM/DLA/03/2025/00320');
    });

    it('should return null if no contract number found', () => {
      const text = 'No contract number here';
      const result = parser.extractContractNumber(text);
      expect(result).toBeNull();
    });
  });

  describe('extractReceiptNumber', () => {
    it('should extract receipt number', () => {
      const text = 'RECU N° 0000004';
      const result = parser.extractReceiptNumber(text);
      expect(result).toBe('0000004');
    });

    it('should extract receipt number with colon', () => {
      const text = 'N°: 0000123';
      const result = parser.extractReceiptNumber(text);
      expect(result).toBe('0000123');
    });

    it('should return null if no receipt number found', () => {
      const text = 'No receipt number here';
      const result = parser.extractReceiptNumber(text);
      expect(result).toBeNull();
    });
  });

  describe('extractCampaign', () => {
    it('should extract campaign with cacaoyère', () => {
      const text = 'Campagne cacaoyère 2023/2024';
      const result = parser.extractCampaign(text);
      expect(result).toBe('2023/2024');
    });

    it('should extract campaign with accented characters', () => {
      const text = 'cacaoyère 2023/2024';
      const result = parser.extractCampaign(text);
      expect(result).toBe('2023/2024');
    });

    it('should return null if no campaign found', () => {
      const text = 'No campaign here';
      const result = parser.extractCampaign(text);
      expect(result).toBeNull();
    });
  });

  describe('extractDate', () => {
    it('should extract date in DD.MM.YYYY format', () => {
      const text = 'Date: 15.03.2024';
      const result = parser.extractDate(text);
      expect(result).toBe('2024-03-15');
    });

    it('should extract date with slash separators', () => {
      const text = 'le 15/03/2024';
      const result = parser.extractDate(text);
      expect(result).toBe('2024-03-15');
    });

    it('should handle single digit day and month', () => {
      const text = 'Date: 5.3.2024';
      const result = parser.extractDate(text);
      expect(result).toBe('2024-03-05');
    });

    it('should return null if no valid date found', () => {
      const text = 'No date here';
      const result = parser.extractDate(text);
      expect(result).toBeNull();
    });
  });

  describe('extractLocation', () => {
    it('should extract all location fields', () => {
      const text = `
        Région: Centre
        Département: Mfoundi
        Arrondissement: Yaoundé 1er
        Village: Nkolbisson
      `;
      const result = parser.extractLocation(text);
      expect(result).toEqual({
        region: 'Centre',
        department: 'Mfoundi',
        arrondissement: 'Yaoundé 1er',
        village: 'Nkolbisson',
      });
    });

    it('should extract partial location data', () => {
      const text = `
        Région: Centre
        Village: Nkolbisson
      `;
      const result = parser.extractLocation(text);
      expect(result).toEqual({
        region: 'Centre',
        village: 'Nkolbisson',
      });
    });

    it('should return null if no location data found', () => {
      const text = 'No location here';
      const result = parser.extractLocation(text);
      expect(result).toBeNull();
    });
  });

  describe('extractActors', () => {
    it('should extract seller and buyer names', () => {
      const text = `
        Nom du vendeur: MBARGA Jean
        Nom de l'acheteur: NKOLO Paul
      `;
      const result = parser.extractActors(text);
      expect(result).toEqual({
        seller: 'MBARGA Jean',
        buyer: 'NKOLO Paul',
      });
    });

    it('should extract with alternative keywords', () => {
      const text = `
        Producteur: MBARGA Jean
        Collecteur: NKOLO Paul
      `;
      const result = parser.extractActors(text);
      expect(result).toEqual({
        seller: 'MBARGA Jean',
        buyer: 'NKOLO Paul',
      });
    });

    it('should return null values if not found', () => {
      const text = 'No actors here';
      const result = parser.extractActors(text);
      expect(result).toEqual({
        seller: null,
        buyer: null,
      });
    });
  });

  describe('extractProfessionalCard', () => {
    it('should extract professional card number', () => {
      const text = 'Carte professionnelle N°: CP123456';
      const result = parser.extractProfessionalCard(text);
      expect(result).toBe('CP123456');
    });

    it('should extract with abbreviated format', () => {
      const text = 'Carte prof. N° CP123456';
      const result = parser.extractProfessionalCard(text);
      expect(result).toBe('CP123456');
    });

    it('should return null if not found', () => {
      const text = 'No card number here';
      const result = parser.extractProfessionalCard(text);
      expect(result).toBeNull();
    });
  });

  describe('extractProductLines', () => {
    it('should extract product lines from table', () => {
      const text = `
        TYPE COMMERCIAUX | POIDS BRUT | HUMIDITE | POIDS NET | PRIX/KG | MONTANT
        Tout Venant       | 500        | 8        | 460       | 1200    | 552000
        G2                | 300        | 7        | 279       | 1500    | 418500
      `;
      const result = parser.extractProductLines(text);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        commercialType: 'Tout Venant',
        grossWeight: 500,
        humidity: 8,
        pricePerKg: 1200,
        amount: 552000,
      });
    });

    it('should return empty array if no table found', () => {
      const text = 'No product table here';
      const result = parser.extractProductLines(text);
      expect(result).toEqual([]);
    });
  });

  describe('extractPayment', () => {
    it('should extract payment mode and amount', () => {
      const text = `
        Mode de paiement: Espèces
        Montant versé: 970500
      `;
      const result = parser.extractPayment(text);
      expect(result).toEqual({
        mode: 'Espèces',
        amountPaid: 970500,
      });
    });

    it('should extract with alternative keywords', () => {
      const text = `
        Espèces
        Versé: 970500
      `;
      const result = parser.extractPayment(text);
      expect(result).toEqual({
        mode: 'Espèces',
        amountPaid: 970500,
      });
    });

    it('should return null if no payment data found', () => {
      const text = 'No payment info here';
      const result = parser.extractPayment(text);
      expect(result).toBeNull();
    });
  });

  describe('parse', () => {
    it('should parse complete receipt text', () => {
      const text = `
        RECU DE COLLECTE D'ACHAT
        N°CONT.M041912772280M-CM/DLA/03/2025/00320
        N° 0000004
        Campagne cacaoyère 2023/2024
        Date: 15.03.2024

        Région: Centre
        Département: Mfoundi
        Arrondissement: Yaoundé 1er
        Village: Nkolbisson

        Nom du vendeur: MBARGA Jean
        Nom de l'acheteur: NKOLO Paul
        Carte professionnelle N°: CP123456

        TYPE COMMERCIAUX | POIDS BRUT | HUMIDITE | POIDS NET | PRIX/KG | MONTANT
        Tout Venant       | 500        | 8        | 460       | 1200    | 552000
        G2                | 300        | 7        | 279       | 1500    | 418500

        Mode de paiement: Espèces
        Montant versé: 970500 XAF
      `;

      const result = parser.parse(text);

      expect(result.contractNumber).toBe('M041912772280M-CM/DLA/03/2025/00320');
      expect(result.receiptNumber).toBe('0000004');
      expect(result.campaign).toBe('2023/2024');
      expect(result.transactionDate).toBe('2024-03-15');
      expect(result.seller).toBe('MBARGA Jean');
      expect(result.buyer).toBe('NKOLO Paul');
      expect(result.professionalCard).toBe('CP123456');
      expect(result.location).toEqual({
        region: 'Centre',
        department: 'Mfoundi',
        arrondissement: 'Yaoundé 1er',
        village: 'Nkolbisson',
      });
      expect(result.productLines).toHaveLength(2);
      expect(result.payment).toEqual({
        mode: 'Espèces',
        amountPaid: 970500,
      });
      expect(result.confidence).toBeDefined();
    });

    it('should handle missing fields gracefully', () => {
      const text = 'Minimal receipt text';
      const result = parser.parse(text);

      expect(result.contractNumber).toBeNull();
      expect(result.receiptNumber).toBeNull();
      expect(result.campaign).toBeNull();
      expect(result.transactionDate).toBeNull();
      expect(result.seller).toBeNull();
      expect(result.buyer).toBeNull();
      expect(result.professionalCard).toBeNull();
      expect(result.location).toBeNull();
      expect(result.productLines).toEqual([]);
      expect(result.payment).toBeNull();
      expect(result.confidence).toBeDefined();
    });
  });
});
