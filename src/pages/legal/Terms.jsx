import { Link } from 'react-router-dom';
import { LegalPage, Sec } from './LegalPage';
import { LEGAL_UPDATED, LEGAL_CONTACT, OPERATOR, OPERATOR_PLACE } from '../../lib/legal';

export default function Terms() {
  const mail = <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>;
  return (
    <LegalPage title="Terms of Service" updated={LEGAL_UPDATED}
      intro={<>These terms are the agreement between you and Fitoor, run by {OPERATOR}, {OPERATOR_PLACE} (“Fitoor”, “we”, “us”). By creating an account or using fitoor.life you agree to them and to our <Link to="/privacy">Privacy Policy</Link>. If you don’t agree, please don’t use Fitoor.</>}
      toc={[['what', 'What Fitoor is'], ['health', 'Not medical advice'], ['ai', 'AI features'], ['account', 'Your account'], ['coaches', 'Coaches'], ['content', 'Your content and recipes'], ['use', 'Fair use'], ['free', 'Service and changes'], ['liability', 'Liability'], ['end', 'Ending your account'], ['law', 'Law and disputes'], ['contact', 'Contact']]}>

      <Sec id="what" title="What Fitoor is">
        <p>Fitoor is an app to log your meals, weight, body measurements, workouts, habits and lab reports, follow a diet plan from your coach, and track progress. Coaches use it to review their clients and give feedback. The public recipe book is open to everyone.</p>
      </Sec>

      <Sec id="health" title="Not medical advice">
        <ul>
          <li>Fitoor, its AI features and its recipes are for general wellness tracking. They are <b>not medical advice, diagnosis or treatment</b> and don’t replace a doctor or registered dietitian.</li>
          <li>Lab flags only compare your values with the range printed on your report. Always discuss results with your doctor.</li>
          <li>Talk to your doctor before starting a new diet, fasting, juice days or exercise, especially if you are pregnant or breastfeeding, have diabetes, kidney, heart, liver or thyroid conditions, an eating disorder, or take medicines.</li>
          <li>Stop and get medical help if you feel unwell. In an emergency, call 112.</li>
        </ul>
      </Sec>

      <Sec id="ai" title="AI features">
        <ul>
          <li>Some features use AI to estimate calories and macros from photos, read scale numbers and lab reports, suggest exercises and turn chat messages into log entries.</li>
          <li>AI can be wrong. You’re responsible for checking results before you save them; you can edit every number.</li>
          <li>Don’t rely on AI output for medical decisions, allergies or dosing.</li>
          <li>Upload only photos and files you have the right to share, and avoid photos of other people.</li>
          <li>How AI handles your data is explained in the <Link to="/privacy#ai">Privacy Policy</Link>.</li>
        </ul>
      </Sec>

      <Sec id="account" title="Your account">
        <ul>
          <li>You must be 18 or older and give true details.</li>
          <li>Keep your password secret. You’re responsible for activity on your account. Tell us quickly if you think someone else has used it.</li>
          <li>One person per account.</li>
        </ul>
      </Sec>

      <Sec id="coaches" title="Coaches">
        <ul>
          <li>Coaches are responsible for the plans and advice they give. Fitoor provides the tool and is not responsible for a coach’s advice.</li>
          <li>Coaches must keep client information confidential, use it only to coach that client on Fitoor, and not copy it out of the app for other uses.</li>
          <li>Coaches must not publish anything that identifies a client without the client’s written consent.</li>
          <li>We may assign, change or remove coaches. When your coach changes, your new coach can see your history.</li>
        </ul>
      </Sec>

      <Sec id="content" title="Your content and recipes">
        <ul>
          <li>You own what you add: logs, photos, notes and recipes.</li>
          <li>You give us permission to store, process and show it as needed to run Fitoor: to you, to your coach and, through our AI provider, for the AI features you use.</li>
          <li>If you publish a recipe, you give us a free, non-exclusive, worldwide licence to show it on fitoor.life and in search results, credited to “Fitoor community”. You can unpublish it any time.</li>
          <li>Recipes must be in your own words, with your own photos. Don’t copy text or photos from other websites or books. A link to a source that inspired you is fine.</li>
          <li>We may remove content that breaks these terms.</li>
        </ul>
      </Sec>

      <Sec id="use" title="Fair use">
        <p>Don’t:</p>
        <ul>
          <li>break the law or anyone’s rights;</li>
          <li>upload harmful, sexual, hateful or misleading content, or other people’s private data;</li>
          <li>try to reach accounts or data that aren’t yours, test our security without permission, or overload the service;</li>
          <li>scrape the app or misuse the AI features (for example, sending non-food content in bulk);</li>
          <li>promote unsafe practices such as extreme fasting, purging or very low-calorie diets.</li>
        </ul>
      </Sec>

      <Sec id="free" title="Service and changes">
        <p>We provide Fitoor “as is” and “as available”. We work to keep it running and accurate, but we can’t promise it will always be available, error-free, or that estimates will be exact. We may add, change or remove features. If we make important changes to these terms, we’ll ask you to agree again in the app.</p>
      </Sec>

      <Sec id="liability" title="Liability">
        <p>To the extent the law allows, Fitoor is not liable for indirect or consequential losses, or for harm caused by relying on AI estimates, coach advice or recipes instead of professional medical advice. Nothing in these terms limits liability that can’t be limited by law, or your rights as a consumer under Indian law.</p>
      </Sec>

      <Sec id="end" title="Ending your account">
        <p>You can stop using Fitoor at any time and ask us to delete your account by emailing {mail}. We may suspend or close accounts that break these terms or put others at risk, and we’ll tell you why unless the law prevents it.</p>
      </Sec>

      <Sec id="law" title="Law and disputes">
        <p>These terms are governed by the laws of India. Let’s try to sort out any problem by talking first: write to us. If we can’t, the courts at Gurugram, Haryana have jurisdiction.</p>
      </Sec>

      <Sec id="contact" title="Contact">
        <p>{OPERATOR}, {OPERATOR_PLACE}. Email: {mail}.</p>
      </Sec>
    </LegalPage>
  );
}
