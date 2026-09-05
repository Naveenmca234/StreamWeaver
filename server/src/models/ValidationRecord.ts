import mongoose, { Schema, Document } from 'mongoose';

export interface IValidationRecord extends Document {
  uploadId: string;
  rowNumber: number;
  fieldName: string;
  field?: string;
  ruleName?: string;
  message: string;
  severity: 'warning' | 'error' | 'info';
  data?: Record<string, unknown>;
  createdBy?: string;
}

const validationRecordSchema = new Schema<IValidationRecord>(
  {
    uploadId: { type: String, required: true, index: true },
    rowNumber: { type: Number, required: true },
    fieldName: { type: String, required: true, index: true },
    field: { type: String, required: false },
    ruleName: { type: String, required: false, default: 'SchemaValidation' },
    message: { type: String, required: true },
    severity: { type: String, enum: ['warning', 'error', 'info'], default: 'error', index: true },
    data: { type: Schema.Types.Mixed, required: false, default: {} },
    createdBy: { type: String, required: false, index: true }
  },
  { timestamps: true }
);

// Virtual alias so that record.field returns record.fieldName if field is not explicitly set
validationRecordSchema.pre('save', function (next) {
  if (!this.field && this.fieldName) {
    this.field = this.fieldName;
  }
  if (!this.fieldName && this.field) {
    this.fieldName = this.field;
  }
  next();
});

export default mongoose.model<IValidationRecord>('ValidationRecord', validationRecordSchema);

