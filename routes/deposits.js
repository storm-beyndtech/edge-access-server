const express = require('express')
const { Transaction } = require("../models/transaction")
const { User } = require("../models/user")
const { alertAdmin, depositMail } = require("../utils/mailer")

const router  = express.Router()


// getting all deposits
router.get('/', async(req, res) => {
  try {
    const deposits = await Transaction.find({ type: "deposit" })
    res.send(deposits)
  } catch(e){ for(i in e.errors) res.status(500).send({message: e.errors[i].message}) }
})



// get all deposits by user
router.get('/user/:email', async(req, res) => {
  const { email } = req.params

  try {
    const deposits = await Transaction.find({ "user.email": email });
    if (!deposits || deposits.length === 0) return res.status(400).send({message: "Deposits not found..."})
    res.send(deposits);
  }
  catch(e){ for(i in e.errors) res.status(500).send({message: e.errors[i].message}) }
})




// making a deposit
router.post('/', async (req, res) => {
  const { id, amount, convertedAmount, coinName } = req.body;

  const user = await User.findById(id);
  if (!user) return res.status(400).send({ message: 'Something went wrong' });

  // Check if there's any pending deposit for the user
  const pendingDeposit = await Transaction.findOne({
    'user.id': id,
    status: 'pending',
    type: 'deposit',
  });

  if (pendingDeposit) {
    return res.status(400).send({ message: 'You have a pending deposit. Please wait for approval.' });
  }

  try {
    const userData = {
      id: user._id,
      email: user.email,
      name: user.fullName,
    };

    const walletData = {
      convertedAmount,
      coinName,
      network: '',
      address: '',
    };

    // Create a new deposit instance
    const transaction = new Transaction({ type: 'deposit', user: userData, amount, walletData });
    await transaction.save();

    const date = transaction.date;
    const type = transaction.type;
    const email = transaction.user.email;

    const emailData = await alertAdmin(email, amount, date, type);
    if (emailData.error) return res.status(400).send({ message: emailData.error });

    res.send({ message: 'Deposit successful and pending approval...' });
  } catch (e) {
    for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
  }
});



// updating a deposit
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { email, amount, status } = req.body;

  let deposit = await Transaction.findById(id);
  if (!deposit) return res.status(404).send({ message: 'Deposit not found' });

  let user = await User.findOne({ email });
  if (!user) return res.status(400).send({ message: 'Something went wrong' });

  try {
    deposit.status = status;

    if (status === 'success') {
      user.deposit += amount;
    }

    user = await user.save()
    deposit = await deposit.save()

    const { fullName, email } = user;
    const { date } = deposit;

    const emailData = await depositMail(fullName, amount, date, email);
    if (emailData.error) return res.status(400).send({ message: emailData.error });

    res.send({ message: 'Deposit successfully updated' });
  } catch (e) {
    for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
  }
});



module.exports = router;
