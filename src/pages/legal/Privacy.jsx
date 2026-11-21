import { Link } from 'react-router-dom';
import { LegalPage, Sec } from './LegalPage';
import { LEGAL_UPDATED, LEGAL_CONTACT, OPERATOR, OPERATOR_PLACE } from '../../lib/legal';

export default function Privacy() {
  const mail = <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>;
  return (
    <LegalPage title="Privacy Policy" updated={LEGAL_UPDATED}
      intro={<>This policy explains what Fitoor collects, why, who can see it, how our AI features use it, and the choices you have. We wrote it in plain words. It is meant to meet India’s Digital Personal Data Protection Act, 2023 (DPDP Act) and the IT Act, 2000 and its rules. Fitoor is run by {OPERATOR}, {OPERATOR_PLACE} (“Fitoor”, “we”, “us”).</>}
      toc={[['short', 'The short version'], ['collect', 'What we collect'], ['why', 'Why we use it'], ['who', 'Who can see your data'], ['ai', 'How we use AI'], ['share', 'Service providers'], ['keep', 'How long we keep it'], ['rights', 'Your rights and choices'], ['security', 'Security'], ['kids', 'Age limit'], ['changes', 'Changes'], ['contact', 'Contact and grievances']]}>

      <Sec id="short" title="The short version">
        <ul>
          <li>You log food, weight, workouts and health data so you and your coach can track progress. That’s what we use it for.</li>
          <li>Only you, your current coach and the Fitoor admin can see your logs. Recipes you choose to publish are public, without your name.</li>
          <li>When you use an AI feature, the photo, file or text for that request is sent to our AI provider to get an answer. You always review the answer before anything is saved.</li>
          <li>We don’t sell your data and we don’t show ads.</li>
          <li>You can ask us to show, correct or delete your data at any time.</li>
        </ul>
      </Sec>

      <Sec id="collect" title="What we collect">
        <h3>Things you give us</h3>
        <ul>
          <li><b>Account:</b> name, email, optional mobile number, password (stored only as a secure hash by our login provider) and the coach code you sign up with.</li>
          <li><b>Profile:</b> gender, height, start and target weight, goal and what you eat (veg, egg, non-veg).</li>
          <li><b>Health and fitness logs:</b> meals (text, photos, calories and macros), weight, waist and body measurements, scale photos, progress photos, water and habits, supplements, workouts, cheat meals and days, juice days, and notes with your coach.</li>
          <li><b>Lab reports:</b> the files you upload and the test values read from them.</li>
          <li><b>Women’s health (optional):</b> PCOS/PCOD, pregnancy status and due date, and period dates, flow and symptoms, only if you choose to add them.</li>
          <li><b>Recipes:</b> recipes and dish photos you add.</li>
        </ul>
        <p>Health data is sensitive. We collect it only with your consent, which you give when you agree to this policy, and only because the app can’t work without it. Fields marked optional really are optional.</p>
        <h3>Things we collect automatically</h3>
        <ul>
          <li><b>Sign-in records:</b> time, IP address, approximate city, region and country, internet provider, and device/browser type, for account security. You can see your own under Me.</li>
          <li><b>Activity records:</b> which features you used and when (for example “logged a meal”, “used the AI scanner”), so your coach can follow your progress and we can fix problems.</li>
          <li><b>On your device:</b> we store your sign-in session, chat history with the AI logger (last 40 messages, kept only on that device), and small settings like inches vs cm. We don’t use advertising or tracking cookies.</li>
        </ul>
      </Sec>

      <Sec id="why" title="Why we use it">
        <ul>
          <li>To run the app: show your day, plan, charts, calendar and progress.</li>
          <li>To let your coach review your logs, write notes and update your plan.</li>
          <li>To give AI estimates you ask for (see <a href="#ai">How we use AI</a>).</li>
          <li>To keep accounts safe: spot unusual sign-ins and misuse.</li>
          <li>To fix bugs and improve features.</li>
          <li>To meet legal duties.</li>
        </ul>
        <p>We do not use your data for advertising, and we do not sell or rent it to anyone.</p>
      </Sec>

      <Sec id="who" title="Who can see your data">
        <ul>
          <li><b>You.</b></li>
          <li><b>Your current coach:</b> can see, add, edit and comment on your logs, plan, lab reports and photos, so they can coach you. If you move to a new coach, your old coach loses access straight away and your new coach can see your history.</li>
          <li><b>The Fitoor admin</b> (super admin): can see all accounts to run the service, assign coaches and help with problems. The admin also sees sign-in records.</li>
          <li><b>The public:</b> only recipes you choose to publish, after a coach approves them. They’re shown as “Fitoor community”, never with your name.</li>
        </ul>
        <p>Coaches must keep your information confidential and use it only to coach you on Fitoor.</p>
      </Sec>

      <Sec id="ai" title="How we use AI">
        <p>Some features use an AI model to read photos and text. These are: the meal photo check, 📸 Guess calories, scale photo reading, the gym machine finder, the lab report reader, ✨ Log by chat, and the coach’s weekly AI check-in.</p>
        <h3>What is sent</h3>
        <ul>
          <li>Only what that request needs: the photo, PDF or text you gave, plus a little context (for example the meal slot, your plan’s items and foods to avoid for that slot, known test or exercise names, or your recent chat lines).</li>
          <li>For the coach’s weekly check-in: your first name, goal, start and target weight, and the last 7 days of meals, weights, workouts and habits, plus out-of-range lab values.</li>
          <li>We don’t send your email, phone number or password to the AI.</li>
        </ul>
        <h3>Who processes it</h3>
        <p>We currently use Anthropic’s Claude models through an API gateway. These services may process data on servers outside India. We use business APIs, not a consumer chatbot. Under the providers’ terms as we understand them, API inputs are not used to train their models by default, but they may keep requests for a limited time for safety and abuse checks. We may change providers; this page will say so.</p>
        <h3>What we keep</h3>
        <p>We keep only the result you choose to save (for example the meal you logged with its estimate) and a short record that an AI feature was used, how long it took and whether it worked. If you close the scanner without logging, the photo is not stored by us.</p>
        <h3>Limits</h3>
        <p>AI estimates can be wrong. Calories can be 20–30% off or more, and lab values or photos can be misread. That’s why you see every result and can edit it before saving. AI output is not medical or dietary advice.</p>
        <h3>Your choice</h3>
        <p>AI features are optional; you can log everything by hand. If you don’t want AI used on your account at all, write to us (or ask your coach to pass it on) and we’ll switch AI off for your account.</p>
      </Sec>

      <Sec id="share" title="Service providers">
        <p>We use these providers to run Fitoor. They handle data on our behalf, only to provide their service:</p>
        <ul>
          <li><b>Supabase:</b> database, login and file storage. Our project is hosted in Mumbai, India.</li>
          <li><b>Netlify:</b> hosts and delivers the website (global network).</li>
          <li><b>Anthropic, via an API gateway:</b> AI features (see above).</li>
          <li><b>ipwho.is:</b> turns the IP address of a sign-in into an approximate location.</li>
          <li><b>Google Fonts:</b> loads the app’s fonts, so Google sees your IP address when fonts download.</li>
        </ul>
        <p>Some of these process data outside India. We only transfer data to countries the Government of India has not restricted. We may also share data if the law requires it, for example a valid order from a court or government authority.</p>
      </Sec>

      <Sec id="keep" title="How long we keep it">
        <ul>
          <li>Your account and logs: until you delete your account or ask us to.</li>
          <li>Sign-in and activity records: 1 year, then deleted automatically.</li>
          <li>Published recipes: until you or we remove them.</li>
          <li>After deletion, copies in backups may last a short while until the backups roll over.</li>
        </ul>
      </Sec>

      <Sec id="rights" title="Your rights and choices">
        <p>Under the DPDP Act you can:</p>
        <ul>
          <li><b>Access:</b> get a summary of the data we hold about you and who we shared it with. Most of it you can already see in the app, and weight, measurements and lab tables can be exported as CSV.</li>
          <li><b>Correct or update:</b> edit your entries in the app, or ask us.</li>
          <li><b>Erase:</b> ask us to delete your account and data.</li>
          <li><b>Withdraw consent:</b> at any time. We’ll stop processing your data, but the app won’t work for you without it.</li>
          <li><b>Nominate someone</b> to use these rights for you if you die or become unable to.</li>
          <li><b>Complain:</b> to our grievance contact below, and if you’re not satisfied, to the Data Protection Board of India.</li>
        </ul>
        <p>Email {mail} from your registered email address. We reply within 30 days.</p>
      </Sec>

      <Sec id="security" title="Security">
        <p>Data is encrypted in transit (HTTPS). Database rules make sure each account can only reach its own data, or its clients’ data for a coach. Photos and files are stored privately and opened through short-lived links. We record sign-ins so you can spot anything unusual. No system is perfectly secure; if a breach affects your data we’ll tell you and the authorities as the law requires.</p>
      </Sec>

      <Sec id="kids" title="Age limit">
        <p>Fitoor is for people aged 18 and over. Please don’t sign up if you’re under 18. If we learn that a child has an account, we will delete it.</p>
      </Sec>

      <Sec id="changes" title="Changes">
        <p>If we change this policy in a way that matters, we’ll show the new version in the app and ask you to agree again before you continue. The date at the top shows the latest version.</p>
      </Sec>

      <Sec id="contact" title="Contact and grievances">
        <p>Grievance contact: {OPERATOR}, {OPERATOR_PLACE}. Email: {mail}. We acknowledge complaints within 48 hours and aim to resolve them within 30 days.</p>
        <p>See also our <Link to="/terms">Terms of Service</Link>.</p>
      </Sec>
    </LegalPage>
  );
}
