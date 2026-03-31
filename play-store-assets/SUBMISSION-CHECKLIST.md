# Google Play Store Submission Checklist

## ✅ Pre-Submission Checklist

### 📦 Build Files
- [x] Signed release AAB: `/android/app/build/outputs/bundle/release/app-release.aab`
- [x] Version code: 1
- [x] Version name: 1.0.0
- [x] App ID: `gold.guap.app`

### 🎨 Graphics & Screenshots
- [x] Screenshots (4 captured):
  - `01-markets.png` - Browse Markets
  - `03-portfolio.png` - Track Positions
  - `04-wallet.png` - Manage Wallet
  - `05-leaderboard.png` - Compete & Win
- [ ] Feature Graphic (1024x500) - **Generate from `scripts/generate-graphics.html`**
- [ ] High-Res Icon (512x512) - **Generate from `scripts/generate-graphics.html`**

### 📝 Store Listing Content
- [x] App name: "GUAP - Prediction Markets"
- [x] Short description (80 chars)
- [x] Full description (4000 chars)
- [x] Category: Finance
- [x] Content rating: Teen (13+)
- [x] Privacy policy: https://guap.gold/privacy
- [x] Support email: support@guap.gold
- [x] Website: https://guap.gold

### 🔐 App Content & Compliance
- [ ] **Data Safety Form** - Complete in Play Console
  - Personal info collected (name, email, phone)
  - Financial info (M-Pesa transactions)
  - App activity (trades, positions)
  - Data encrypted in transit and at rest
  - No data sold to third parties

- [ ] **Content Rating Questionnaire** - Complete in Play Console
  - Simulated gambling (prediction markets)
  - Real money transactions
  - Age restriction: 18+

- [ ] **Target Audience**
  - Primary: 18+
  - Secondary: Young adults

- [ ] **App Access**
  - Login required: Yes
  - Test credentials provided: Yes
    - Email: test@guap.gold
    - Password: TestAccount2024!

- [ ] **Ads Declaration**
  - Contains ads: No
  - In-app purchases: No (real money via M-Pesa)

### 🌍 Distribution
- [x] Primary country: Tanzania
- [x] Additional countries: Kenya, Uganda, Rwanda
- [x] Worldwide availability (with restrictions)

---

## 📋 Step-by-Step Submission Process

### 1. Create Google Play Console Account
- [ ] Go to https://play.google.com/console
- [ ] Pay $25 one-time registration fee
- [ ] Complete developer profile
- [ ] Verify identity

### 2. Create New App
- [ ] Click "Create app"
- [ ] Enter app name: "GUAP - Prediction Markets"
- [ ] Select default language: English (US)
- [ ] App type: App
- [ ] Free or paid: Free
- [ ] Accept declarations

### 3. Set Up Store Listing
- [ ] Upload screenshots (4 minimum)
- [ ] Upload feature graphic (1024x500)
- [ ] Upload high-res icon (512x512)
- [ ] Enter short description
- [ ] Enter full description
- [ ] Select app category: Finance
- [ ] Add contact email: support@guap.gold
- [ ] Add privacy policy URL: https://guap.gold/privacy
- [ ] Add website URL: https://guap.gold

### 4. Complete Content Rating
- [ ] Start questionnaire
- [ ] Select "Simulated gambling"
- [ ] Answer all questions honestly
- [ ] Receive rating (likely Teen/PEGI 12)

### 5. Set Up Pricing & Distribution
- [ ] Select countries: Tanzania, Kenya, Uganda, Rwanda, + Worldwide
- [ ] Confirm app is free
- [ ] Check content guidelines compliance
- [ ] Check US export laws compliance

### 6. Complete Data Safety
- [ ] Data collection: Yes
  - Personal info (name, email, phone)
  - Financial info (transactions, balance)
  - App activity (trades, markets)
- [ ] Data usage: App functionality, payments, analytics
- [ ] Data sharing: Payment processor only
- [ ] Security: Encrypted in transit and at rest

### 7. Set Up App Access
- [ ] Login required: Yes
- [ ] Provide test credentials:
  - Username: test@guap.gold
  - Password: TestAccount2024!
- [ ] Add instructions for reviewers

### 8. Upload App Bundle
- [ ] Go to "Release" → "Production"
- [ ] Create new release
- [ ] Upload `app-release.aab`
- [ ] Enter release name: "1.0.0 - Initial Release"
- [ ] Add release notes (see listing-content.md)
- [ ] Review and confirm

### 9. Submit for Review
- [ ] Review all sections for completeness
- [ ] Fix any warnings or errors
- [ ] Click "Submit for review"
- [ ] Wait for approval (typically 1-7 days)

---

## 🚨 Common Issues & Solutions

### Issue: "Missing feature graphic"
**Solution**: Generate from `scripts/generate-graphics.html` and upload

### Issue: "Content rating required"
**Solution**: Complete questionnaire in Play Console

### Issue: "Privacy policy required"
**Solution**: Already available at https://guap.gold/privacy

### Issue: "Test account doesn't work"
**Solution**: Create test account in production database or provide working credentials

### Issue: "Real money gambling concerns"
**Solution**: Clarify it's prediction markets, not gambling. Provide regulatory compliance info.

### Issue: "Age restriction"
**Solution**: Set to 18+ due to real money trading

---

## 📞 Support Contacts

**Google Play Support**: https://support.google.com/googleplay/android-developer
**GUAP Support**: support@guap.gold
**Developer**: Your contact info

---

## 🎯 Post-Submission

### After Approval
- [ ] Monitor crash reports in Play Console
- [ ] Respond to user reviews
- [ ] Track installs and engagement
- [ ] Plan updates and improvements

### Marketing
- [ ] Share Play Store link on social media
- [ ] Add "Get it on Google Play" badge to website
- [ ] Create launch announcement
- [ ] Reach out to press/bloggers

---

## 📊 Current Status

**Build**: ✅ Ready
**Screenshots**: ✅ 4/5 captured (missing market detail)
**Graphics**: ⚠️ Need to generate (use HTML tool)
**Listing Content**: ✅ Written
**Compliance**: ⚠️ Need to complete in Play Console

**Next Steps**:
1. Open `scripts/generate-graphics.html` in browser
2. Download feature graphic and hi-res icon
3. Create Play Console account
4. Follow submission steps above
