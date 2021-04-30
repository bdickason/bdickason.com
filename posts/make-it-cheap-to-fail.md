---
title: Make it cheap to fail
date: 2021-04-30
description: "Humans learn by failing. But failure can be expensive. The best products let you fail fast without long wait times or increased costs. They make it cheap to fail."
thumbnail: /static/posts/make-it-cheap-to-fail/groundhog-day.jpg
layout: layouts/post.njk
---

# Make it cheap to fail

Humans learn by failing. From an early age, you learn that pain means 'stop doing that.' If you touch a hot stove, your hand burns. If you fall off the bed, your head hurts. It's not fun, but it's effective.

If you work in tech, you've likely embraced this style of learning and celebrate teams that 'fail fast.' Ship products early so you can test your hypotheses and learn as quickly as possible.

The best products also embrace this mentality. They let you fail and learn what works:

* Figma reduces the time it takes to get feedback on a design to zero by baking in collaboration from the beginning. No more surprises when your colleague sees your design after weeks of work.
* Browsers save your history and restore your tabs when you quit. No more losing your place or forgetting that site you visited to check the price on those beanie babies you hoarded when you were a kid. 
* Super Mario Brothers has no tutorial. It just starts you on a level and you have to learn how to jump over an enemy turtle within the first few seconds of playing. If you fail, you start over.

Unfortunately, these products are the exception, not the norm. It's often incredibly expensive to fail in modern software.

## Products where failure is expensive

Have you ever triggered a software update on your laptop (or had an IT administrator trigger it automatically)? The dialog looks innocent: "Click 'Update' to restart your computer" but fails to let you know that the installation can take between 30 minutes and two hours. There is no cancel, there is no undo. You're stuck.

<img src="{{ thumbnail }}" />
<p class="caption">Bill Murray learned via failing repeatedly in Groundhog day.</p>

Video sharing apps are just as bad. My wife loves recording videos with Instagram but sometimes the video upload fails. Her video ends up in a stuck state where she can't download it and can't re-upload it. The moment is lost and the memory only lives in her head.

Purchasing ads on Google adsense with the wrong keywords or limits can [lead to massive bills and thousands of dollars](https://www.reddit.com/r/PPC/comments/e4ning/google_spent_75x_my_daily_budget_so_far/) worth of ads shown to the wrong users.

Each of these products has an extensive New User Experience (NUX), tutorials, and a help center. **Developers go to great lengths to teach users about their product but need to do more to make failure fast and cheap.**

## How to decrease the cost of failure

**Give a lightweight preview in advance of a heavy action**

Every week I send a newsletter to hundreds of subscribers. You're trusting me with access to your inbox so I want to make sure the email looks good on every device. ConvertKit offers a simple 'Send a Preview' button in their editing interface. I can quickly fire off a preview of the newsletter I'm about to send to my mobile device so I can make sure it looks good on all screens.

I use this feature every freakin' time I'm about to send a newsletter to reduce the uncertainty around sending out something broken.

**Automatically save state / auto-resume**

In the early days of BBS and the internet, dialup modems were incredibly slow and downloading large files could take hours or sometimes days. The phone connection was fickle and often dropped connection. If anyone in your house picked up the phone, it would also drop your connection. Any downloads would terminate immediately.

Then someone invented download resuming. This. Changed. Everything.

My 16-hour download that terminated with 0.1% remaining didn't have to be re-done from scratch! I no longer had to worry about big downloads because I was confident that even if they were interrupted, I could easily resume.

**Allow abort / undo / refunds after an action**

Email has historically been a 'send and forget' experience. If you have a typo or forget to cc someone and hit send, you're out of luck. One of the most popular plugins in the early days of Gmail was called 'Undo Send.' It was simple and brilliant: Undo Send delayed sending your email for a short period of time in case you caught an error. This simple plugin caught countless problematic emails and is now included in the Gmail's Settings.

Amazon is another great example. You can cancel your purchase from Amazon within hours, regardless of reason, and the item will be instantly refunded. This has led to at least a few impromptu purchases on my end because I'm not worried about ending up with something I don't want.

**Surface common actions before long processes**

ATM's are notoriously slow and frustrating. It takes a long time to load the main UI after you've entered your PIN. Entering the wrong amount or hitting cancel can force you to start from the beginning and insert your cart and PIN all over again.

Many ATM's have introduced a 'fast cash' option to remedy this. Now, when entering your pin, you can select 'Fast Cash: $100' instead of 'Enter' which takes you to the main menu.

You skip all the slow menus and accidental typing and jump right to your desired outcome: cash in hand.

**Decrease the actual cost**

The promise of cryptocurrency is that it's fast and cheap to send money because you're just moving bits. In the crypto world, there are two competing developer networks. Each charges a fee per transaction. The original popular developer network (Ethereum) has risen in price so each transaction costs between $30-60. For beginners, this means that you pay a sizeable chunk every time you want to experiment.

A new network (BSC) keeps costs low so each transaction costs a fraction of cents. This means you can experiment repeatedly without worrying about the fees.

As a result, [BSC has overtaken ETH in daily transactions](https://www.coindesk.com/pancakeswap-binance-smart-chain-flippening-ethereum-transactions) by an order of magnitude:

<img src="/static/posts/make-it-cheap-to-fail/eth-vs-bsc.png" />

Minimize the amount of pain in your product. Assume that people want to fail repeatedly. Bake in ways to fail fast, but make it painless. Make it part of your core user experience. Your users will iterate faster and produce much better outcomes.

*Bonus: My favorite example of a product that makes it incredibly expensive to fail is near my office: If you miss the turn off 1 Hacker Way into the Facebook campus, there's only one other turn before you end up on the Dumbarton bridge. Not only do you have to drive across the entire bridge, turn around, and sit in traffic on the way back... You have to pay a $6 toll!*

*My wife missed the turn once when picking me up and was fuming by the time she made it back to campus 😤*

**Have you used a product that makes it expensive to fail? I'd love to hear about it:  [@bdickason](http://twitter.com/bdickason)**

<strong>Get my newsletter.</strong>  It features simple improvements you can make to build great products. Learn the strategies employed by the best Product Managers in Silicon Valley.


{% include components/mailinglist.njk %}

{% include components/share.njk %}

{% include components/date.njk %}

{% include components/posts.njk %}