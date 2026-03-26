# AWS Textract OCR Setup Guide

This guide explains how to configure AWS Textract for automatic text extraction from PDF receipts in CocoaTrack V2.

## Overview

AWS Textract is a machine learning service that automatically extracts text, handwriting, and data from scanned documents. It's used in the receipt import feature to automatically extract information from scanned collection receipts.

## Prerequisites

- AWS Account with Textract access
- IAM user with appropriate permissions
- AWS SDK installed (already done: `@aws-sdk/client-textract`)

## Step 1: Create IAM User

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Click "Users" → "Add users"
3. Enter username (e.g., `cocoatrack-textract`)
4. Select "Access key - Programmatic access"
5. Click "Next: Permissions"

## Step 2: Attach Textract Policy

Attach the following policy to your IAM user:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "textract:DetectDocumentText",
        "textract:AnalyzeDocument"
      ],
      "Resource": "*"
    }
  ]
}
```

Or use the AWS managed policy: `AmazonTextractFullAccess` (for development only)

## Step 3: Get Access Keys

1. After creating the user, click "Create access key"
2. Select "Application running outside AWS"
3. Copy the **Access Key ID** and **Secret Access Key**
4. Store them securely (you won't be able to see the secret key again)

## Step 4: Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# OCR Provider
OCR_PROVIDER=aws

# AWS Credentials
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key

# OCR Timeout (optional, default: 30000ms)
OCR_TIMEOUT=30000
```

### Available AWS Regions

Choose a region close to your users for better performance:
- `us-east-1` - US East (N. Virginia)
- `us-west-2` - US West (Oregon)
- `eu-west-1` - Europe (Ireland)
- `eu-central-1` - Europe (Frankfurt)
- `ap-southeast-1` - Asia Pacific (Singapore)

## Step 5: Test the Configuration

1. Restart your development server:
   ```bash
   pnpm dev
   ```

2. Navigate to the receipt import page
3. Upload a PDF receipt
4. Select "Extraction automatique (OCR)"
5. Check the console for OCR logs

## Limitations

### File Size
- **Maximum**: 5MB for synchronous operations (DetectDocumentText)
- For larger files, you would need to implement async operations with S3

### Supported Formats
- PDF (single page for DetectDocumentText)
- For multi-page PDFs, use AnalyzeDocument or StartDocumentTextDetection

### Language Support
- Textract supports multiple languages including French
- No additional configuration needed for French text

## Pricing

AWS Textract pricing (as of 2024):
- **DetectDocumentText**: $1.50 per 1,000 pages
- **AnalyzeDocument**: $50 per 1,000 pages (for forms/tables)

For the receipt import feature, we use DetectDocumentText which is more cost-effective.

**Example cost calculation:**
- 1,000 receipts/month = $1.50/month
- 10,000 receipts/month = $15/month

## Troubleshooting

### Error: "AWS Textract not configured"

Check that all three environment variables are set:
```bash
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

### Error: "AccessDeniedException"

Your IAM user doesn't have Textract permissions. Attach the policy from Step 2.

### Error: "PDF file too large"

The PDF exceeds 5MB. Options:
1. Compress the PDF before upload
2. Implement async processing with S3 (requires additional setup)

### Error: "OCR extraction timeout"

The extraction took longer than 30 seconds. Options:
1. Increase `OCR_TIMEOUT` in `.env.local`
2. Use manual entry instead
3. Check your network connection to AWS

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use IAM roles** in production (EC2, ECS, Lambda)
3. **Rotate access keys** regularly
4. **Use least privilege** - only grant necessary permissions
5. **Enable CloudTrail** to audit Textract API calls

## Alternative: Using IAM Roles (Production)

For production deployments on AWS infrastructure:

1. Create an IAM role with Textract permissions
2. Attach the role to your EC2/ECS/Lambda
3. Remove `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from `.env`
4. The AWS SDK will automatically use the role credentials

## Monitoring

Monitor your Textract usage in AWS CloudWatch:
- API call count
- Error rates
- Latency
- Costs

## Support

- [AWS Textract Documentation](https://docs.aws.amazon.com/textract/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-textract/)
- [Textract Pricing](https://aws.amazon.com/textract/pricing/)

## Next Steps

After configuring AWS Textract:
1. Test with sample receipts
2. Monitor extraction accuracy
3. Adjust the receipt parser patterns if needed
4. Consider implementing caching for repeated extractions
