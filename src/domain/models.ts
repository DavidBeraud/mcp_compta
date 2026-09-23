export type Profile = 'FR_GENERAL' | 'FR_BTP_PRIVATE' | 'FR_BTP_PUBLIC';
export type DocumentType = 'QUOTE' | 'STANDARD_INVOICE' | 'DEPOSIT_INVOICE' | 'PROGRESS_INVOICE' | 'FINAL_INVOICE' | 'CREDIT_NOTE';
export type VatTreatment = 'STANDARD' | 'REDUCED' | 'EXEMPT' | 'FRANCHISE' | 'REVERSE_CHARGE' | 'OUT_OF_SCOPE';
export type DecisionResult = 'VALID' | 'INVALID' | 'NEEDS_INFORMATION' | 'REQUIRES_EXPERT_REVIEW';
export type Severity = 'BLOCKING' | 'WARNING' | 'INFO';

export interface Address { line1: string; line2?: string; postalCode: string; city: string; country: string }
export interface LegalEntity { id: string; name: string; country: string; address: Address; vatNumber?: string; registrationNumber?: string }
export interface Customer { id: string; name: string; type: 'BUSINESS' | 'CONSUMER' | 'PUBLIC_ENTITY'; address: Address; vatNumber?: string }
export interface InvoiceLine {
  id: string; description: string; quantity: string; unit?: string; unitPriceExVat: string;
  discountRate?: string; vatTreatment: VatTreatment; vatRate?: string;
}
export interface InvoiceInput {
  id?: string; number?: string; type: DocumentType; profile: Profile; status?: 'DRAFT' | 'VALIDATED' | 'ISSUED';
  issueDate?: string; transactionDate: string; operationDate?: string; currency: string;
  seller?: LegalEntity; customer?: Customer; lines: InvoiceLine[]; paymentTerms?: string; dueDate?: string;
  specialMention?: string; originalInvoiceId?: string; depositAllocations?: DepositAllocation[];
}
export interface Quote { id: string; number: string; profile: Profile; currency: string; lines: InvoiceLine[]; validUntil?: string }
export interface CreditNote { id: string; originalInvoiceId: string; reason: string; invoice: InvoiceInput }
export interface TaxBreakdown { treatment: VatTreatment; rate: string | null; taxableAmount: string; vatAmount: string }
export interface CalculatedLine extends InvoiceLine { grossAmount: string; discountAmount: string; netExVat: string; vatAmount: string; totalInclVat: string }
export interface InvoiceCalculation { lines: CalculatedLine[]; totalExVat: string; totalVat: string; totalInclVat: string; taxBreakdown: TaxBreakdown[]; depositOffset: string; amountDue: string }
export interface RuleSource { authority: string; title: string; url: string }
export interface Rule { id: string; version: string; jurisdiction: 'FR'; module: 'FR_GENERAL' | 'FR_BTP' | 'FR_BTP_PUBLIC'; title: string; nature: string; severity: Severity; effective_from: string; effective_to: string | null; status: 'ACTIVE' | 'FUTURE' | 'DEPRECATED'; legal_review_required?: boolean; applies_if: string; validation: string; effect: string; source: RuleSource; notes?: string }
export interface RuleDecision { ruleId: string; ruleVersion: string; result: DecisionResult; severity: Severity; reason: string; evidence: Record<string, unknown>; source: RuleSource }
export interface FinancialResponse<T> { result: DecisionResult; calculations: T; validations: RuleDecision[]; rulesApplied: { ruleId: string; ruleVersion: string }[]; warnings: string[] }
export interface DepositAllocation { depositId: string; amount: string }
export interface Deposit { id: string; kind: 'DEPOSIT_REQUEST' | 'DEPOSIT_INVOICE' | 'DEPOSIT_PAYMENT'; amount: string; allocatedAmount: string }
export interface Advance { id: string; contractId: string; amount: string; paidAmount: string; recoveredAmount: string }
export interface AdvanceRecovery { id: string; advanceId: string; progressStatementId: string; amount: string; strategy: AdvanceRecoveryInput['strategy'] }
export interface Payment { id: string; amount: string; currency: string; allocations: PaymentAllocation[] }
export interface PaymentAllocation { id: string; paymentId: string; invoiceId: string; amount: string; idempotencyKey: string }
export interface Amendment { id: string; amount: string; status: 'DRAFT' | 'APPROVED' | 'REJECTED' | 'CANCELLED' }
export interface ContractLine { id: string; description: string; amount: string }
export interface Contract { id: string; profile: 'FR_BTP_PRIVATE' | 'FR_BTP_PUBLIC'; originalAmount: string; lines: ContractLine[]; amendments: Amendment[] }
export interface ProgressHistory { statementId: string; validated: true; currentCumulative: string; lineCumulatives?: Record<string, string> }
export interface ProgressStatement { id: string; contractId: string; sequence: number; status: 'DRAFT' | 'VALIDATED' | 'INVOICED'; currentCumulative: string; periodAmount: string; lines: ProgressLine[] }
export interface ProgressLine { contractLineId: string; previousCumulative: string; currentCumulative: string; periodAmount: string }
export interface ProgressInput { contract: Contract; transactionDate: string; currentCumulative?: string; percentages?: Record<string, string>; lineCumulatives?: Record<string, string>; validatedHistory: ProgressHistory[]; explicitCorrection?: boolean; allowOverbilling?: boolean; retention?: RetentionInput; advanceRecovery?: AdvanceRecoveryInput }
export interface RetentionInput { mode: 'WITHHOLDING' | 'SUBSTITUTE_GUARANTEE' | 'CONSIGNMENT'; rate?: string; contractuallyAllowed: boolean; holderIsSme?: boolean; publicBuyerEligibleForSmeCap?: boolean }
export interface Retention { id: string; contractId: string; mode: RetentionInput['mode']; rate: string; withheldAmount: string; releasedAmount: string }
export interface RetentionRelease { id: string; retentionId: string; amount: string; eligibleAt: string; status: 'PENDING' | 'ELIGIBLE' | 'RELEASED' | 'BLOCKED_BY_RESERVATIONS' }
export interface AdvanceRecoveryInput { advanceId: string; strategy: 'FIXED_AMOUNT' | 'PERCENTAGE_OF_PERIOD' | 'CONTRACT_FORMULA'; value?: string; formulaReference?: string; remainingAdvance: string }
export interface ProgressCalculation { approvedContractAmount: string; previousCumulative: string; currentCumulative: string; periodAmount: string; retentionAmount: string; advanceRecoveryAmount: string; payableAmount: string; lineCumulatives?: Record<string, string> }
export interface AccountingEvent { id: string; type: 'INVOICE_ISSUED' | 'CREDIT_NOTE_ISSUED' | 'PAYMENT_ALLOCATED' | 'RETENTION_WITHHELD' | 'RETENTION_RELEASED'; occurredAt: string; amounts: Record<string, string>; referenceId: string }
export interface AccountingEntry { account: string; label: string; debit: string; credit: string }
export interface AccountMapping { receivable: string; revenue: string; vatCollected: string; bank: string; retentionReceivable: string }
export interface AuditEvent { id: string; actorId: string; occurredAt: string; action: string; entityId: string; idempotencyKey: string; previousState?: unknown; newState: unknown; ruleVersions: { ruleId: string; ruleVersion: string }[]; input: unknown; output: unknown }
export interface Reception { id: string; contractId: string; receptionDate: string; reservations: Reservation[] }
export interface Reservation { id: string; description: string; status: 'OPEN' | 'CLOSED'; openedAt: string; closedAt?: string; evidence?: string }
export interface ChorusProMetadata { engagementNumber?: string; serviceCode?: string; publicStructureId: string; contractNumber: string }
