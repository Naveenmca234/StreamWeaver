import mongoose, { Schema, Document } from 'mongoose';

export interface IPipelineStage {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt?: Date;
  finishedAt?: Date;
  error?: string;
  count?: number;
}

export interface IImportJob extends Document {
  uploadId: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  failedRows: number;
  fileSize?: number;
  columns?: string[];
  selectedColumns?: string[];
  mapping?: Record<string, any>;
  cleaningStrategies?: Record<string, { strategy: string; fillValue?: string }>;
  stages?: {
    ingestion?: IPipelineStage;
    cleaning?: IPipelineStage;
    mapping?: IPipelineStage;
    transformation?: IPipelineStage;
    validation?: IPipelineStage;
  };
  profile?: any;
  errorMessage?: string;
  transformedAt?: Date;
  importedAt?: Date;
  importedRows?: number;
  createdBy?: string;
  startedAt?: Date;
  finishedAt?: Date;
  memoryAudit?: {
    peakRss?: number;
    peakHeap?: number;
    avgRss?: number;
    avgHeap?: number;
    samples?: number;
    savedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const importJobSchema = new Schema<IImportJob>(
  {
    uploadId: { type: String, required: true, unique: true },
    fileName: { type: String, required: true },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
    totalRows: { type: Number, default: 0 },
    failedRows: { type: Number, default: 0 },
    fileSize: { type: Number, default: 0 },
    columns: { type: [String], default: [] },
    selectedColumns: { type: [String], default: [] },
    mapping: { type: Schema.Types.Mixed, default: {} },
    cleaningStrategies: { type: Schema.Types.Mixed, default: {} },
    stages: {
      type: Schema.Types.Mixed,
      default: {
        ingestion: { status: 'completed' },
        cleaning: { status: 'pending' },
        mapping: { status: 'pending' },
        transformation: { status: 'pending' },
        validation: { status: 'pending' }
      }
    },
    profile: { type: Schema.Types.Mixed, default: null },
    errorMessage: { type: String },
    createdBy: { type: String },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    transformedAt: { type: Date },
    importedAt: { type: Date },
    importedRows: { type: Number, default: 0 },
    memoryAudit: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

export default mongoose.model<IImportJob>('ImportJob', importJobSchema);
