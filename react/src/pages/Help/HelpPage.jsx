import { HelpCircle, Mail, FileText, ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

const faqs = [
  {
    question: 'What is XIRR and why does it matter?',
    answer:
      'XIRR (Extended Internal Rate of Return) calculates your true returns accounting for irregular cash flows like SIPs. Unlike simple returns, it gives you an accurate annualized return figure.',
  },
  {
    question: 'How do I get my CAMS/KFintech statement?',
    answer:
      'Visit camsonline.com or kfintech.com, go to Investor Services, select Consolidated Account Statement, enter your PAN and email, and download the PDF sent to your email.',
  },
  {
    question: 'What does overlap analysis show?',
    answer:
      'Overlap analysis identifies stocks that appear in multiple funds. High overlap (like Reliance in 4 funds) reduces diversification benefits and concentrates risk.',
  },
  {
    question: 'Should I switch to direct plans?',
    answer:
      'Direct plans have lower expense ratios (typically 0.5-1% less). Over the long term, this significantly impacts returns. Consider switching when tax impact is minimal.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Yes. All processing happens in your browser. We do not store your statement, transactions, or personal financial data on any server.',
  },
];

export function HelpPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Help & Support</h1>
        <p className="text-gray-500 mt-1">
          Get answers to common questions and learn how to use FinSage AI
        </p>
      </div>

      {/* FAQs */}
      <Card>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {faqs.map((faq, idx) => (
              <div key={idx} className="border-b border-gray-100 pb-4 last:border-0">
                <h3 className="font-semibold text-gray-900 mb-2">{faq.question}</h3>
                <p className="text-sm text-gray-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resources */}
      <Card>
        <CardHeader>
          <CardTitle>Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <a
              href="https://www.amfiindia.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 border border-gray-100 rounded-lg hover:border-blue-200 hover:bg-blue-50 transition-colors"
            >
              <ExternalLink className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">AMFI India</p>
                <p className="text-sm text-gray-500">Official mutual fund portal</p>
              </div>
            </a>
            <a
              href="https://www.incometax.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 border border-gray-100 rounded-lg hover:border-blue-200 hover:bg-blue-50 transition-colors"
            >
              <ExternalLink className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">Income Tax India</p>
                <p className="text-sm text-gray-500">Tax filing and information</p>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Need More Help?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            If you have questions not covered here, feel free to reach out.
          </p>
          <Button variant="primary" icon={Mail}>
            Contact Support
          </Button>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500 leading-relaxed">
          <strong>Disclaimer:</strong> FinSage AI is for educational and informational purposes
          only. It does not constitute investment advice. Mutual fund investments are subject to
          market risks. Please read all scheme related documents carefully before investing.
          Consult a SEBI-registered investment advisor for personalized financial planning.
        </p>
      </div>
    </div>
  );
}

export default HelpPage;
