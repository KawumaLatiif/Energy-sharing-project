from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transactions', '0005_alter_transactionlog_transaction_type'),
    ]

    operations = [
        migrations.AlterField(
            model_name='transactionlog',
            name='transaction_type',
            field=models.CharField(
                choices=[
                    ('WALLET_DEPOSIT', 'Wallet Deposit'),
                    ('WALLET_WITHDRAWAL', 'Wallet Withdrawal'),
                    ('LOAN_APPLICATION', 'Loan Application'),
                    ('LOAN_APPROVAL', 'Loan Approval'),
                    ('LOAN_DISBURSEMENT', 'Loan Disbursement'),
                    ('LOAN_REPAYMENT', 'Loan Repayment'),
                    ('LOAN_COMPLETION', 'Loan Completion'),
                    ('UNIT_PURCHASE', 'Unit Purchase'),
                    ('UNIT_SHARE', 'Unit Share'),
                    ('UNIT_TRANSFER', 'Unit Transfer'),
                ],
                max_length=50,
            ),
        ),
    ]
