"use strict"

const api = require("./api")

// TODO we need NLP here :)
// TODO there must be a away to reset the state
// TODO doesn't work if user is both, sender & recipient, at the same time
const states = {
	fetchingUserProfile: {
		handleMessage: function() {
			this.sendTextMessage("One moment please, I'm there for you shortly!")
		}
	},

	neutral: {
		handleMessage: function(text) {
			const matchingText = text.toLowerCase()
			if (matchingText.indexOf("camera") < 0) {
				return false
			}
			if (matchingText.indexOf("lend") < 0 && matchingText.indexOf("give") < 0) {
				return false
			}

			const that = this

			this.continueWithUserProfile(function() {
				that.sendTextMessage("Awesome! Can you send me a photo of it?")
				that.state = "sender_waitingForPhoto"
			})
		},

		handlePostback: function(payload, referral) {
			if (payload !== "GET_STARTED") {
				return false
			}

			const that = this

			this.continueWithUserProfile(function(user) {
				const userFirstName = user.first_name

				const reference = referral && referral.ref
				if (reference) {
					that.continueForRecipientWithReference(reference)
				}
				else {
					that.sendTextMessage("Hey " + userFirstName + ", how can I help you?")
					that.state = "neutral"
				}
			})
		},

		handleReferral: function(referral) {
			const reference = referral && referral.ref
			if (reference) {
				const that = this

				this.continueWithUserProfile(function() {
					that.continueForRecipientWithReference(reference)
				})
			}
		}
	},

	recipient_waitingForPayment: {
		handleMessage: function(text) {
			this.sendTextMessage("I'm waiting for your payment.")
		}
	},

	sender_waitingForDuration: {
		handleMessage: function(text) {
			const matchingText = text.toLowerCase()
			if (matchingText.indexOf("days") < 0) {
				return false
			}

			const that = this
			this.duration = "2 days"

			const ref = JSON.stringify({
				"duration":   this.duration,
				"imageUrl":   this.imageUrl,
				"lenderId":   this.userId,
				"lenderName": this.user.first_name + " " + this.user.last_name,
				"object":     this.object,
				"price":      this.price
			})

			const link = "https://www.messenger.com/t/" + process.env.PAGE_ID + "?ref=" + encodeURIComponent(ref)

			this.sendTextMessage("Sure, we can do that!")
			setTimeout(function() {
				that.sendTextMessage("Share this link with your friend:")
				that.sendGenericTemplate({
						elements: [{
							image_url: that.imageUrl,
							title:     "Borrow my " + that.object + "!",
							subtitle:  that.duration + " including damage and theft coverage!",
							buttons:   [{
								type:           "element_share",
								share_contents: {
									attachment: {
										type:    "template",
										payload: {
											template_type: "generic",
											elements:      [{
												image_url: that.imageUrl,
												title:     "Borrow my " + that.object + "!",
												subtitle:  that.duration + " including damage and theft coverage!",
												buttons:   [{
													"type":  "web_url",
													"title": "Check out Offer",
													"url":   link
												}]
											}]
										}
									}
								}
							}]
						}]
					}
				)
				setTimeout(function() {
					that.sendTextMessage("I’ll write you once your friend has accepted your request.")
				}, 3000)
			}, 1000)
			this.state = "neutral"
		}
	},

	sender_waitingForPhoto: {
		handleMessage: function(_, attachments) {
			if (!attachments || !attachments.length) {
				this.sendTextMessage("You must send me a photo.")
				return
			}

			const attachment = attachments[0]
			if (attachment.type !== "image") {
				this.sendTextMessage("Sorry, but it has to be a photo!")
				return
			}

			const that = this
			this.imageUrl = attachment.payload.url
			this.object = "Nikon Camera"
			this.price = 250

			this.sendTextMessage("One sec, let me check it out…")
			setTimeout(function() {
				that.sendTextMessage("Cool " + that.object + "!\nI estimated that it's worth $" + that.price + ".\nAre you okay with that?")
			}, 3000)
			this.state = "sender_waitingForPriceAcceptance"
		}
	},

	sender_waitingForPrice: {
		handleMessage: function(text) {
			const priceMatches = text.match(/\d+/)
			const price = priceMatches && priceMatches[0]
			if (!price) {
				return false
			}

			const that = this
			this.price = Number.parseInt(price)

			this.sendTextMessage("Okay, seems reasonable.")
			setTimeout(function() {
				that.sendTextMessage("For how long would you like to lend it out?")
			}, 1000)
			this.state = "sender_waitingForDuration"
		}
	},

	sender_waitingForPriceAcceptance: {
		handleMessage: function(text) {
			const matchingText = text.toLowerCase()

			if (matchingText.indexOf("yes") >= 0) {
				this.sendTextMessage("Excellent! For how long would you like to lend it out?")
				this.state = "sender_waitingForDuration"
			}
			else if (matchingText.indexOf("no") >= 0 || matchingText.indexOf("low") >= 0 || matchingText.indexOf("high") >= 0) {
				this.sendTextMessage("What do you think it's worth?")
				this.state = "sender_waitingForPrice"
			}
			else {
				return false
			}
		}
	}
}


const Conversation = function(userId) {
	this.state = "neutral"
	this.userId = userId
}
module.exports = Conversation


Conversation.prototype.continueForRecipientWithReference = function(reference) {
	const info = JSON.parse(reference)
	this.duration = info.duration
	this.imageUrl = info.imageUrl
	this.lenderId = info.lenderId
	this.lenderName = info.lenderName
	this.object = info.object
	this.price = info.price

	this.sendTextMessage("Hey " + this.user.first_name + ",\n" + this.lenderName + " would like to lend out a " + this.object + " to you.")
	this.sendTextMessage("It's worth $" + this.price + " and the following price covers damage and theft. Is that okay?")
	this.sendGenericTemplate({
		elements: [{
			image_url: this.imageUrl,
			title:     this.object,
			subtitle:  this.duration + " including damage and theft coverage!",
			buttons:   [{
				type:  "web_url",
				title: "Accept & Pay",
				url:   "https://www.paypal.com"
			}]
		}]
	})
	this.state = "recipient_waitingForPayment"
}


Conversation.prototype.continueWithUserProfile = function(callback) {
	if (this.user) {
		setImmediate(callback, this.user)
	}
	else {
		const previousState = this.state
		this.state = "fetchingUserProfile"

		const that = this

		api.fetchUserProfile(this.userId, function(error, user) {
			that.user = user
			that.state = previousState

			callback(user)
		})
	}
}


Conversation.prototype.handleMessage = function(text, attachments) {
	const state = states[this.state]
	if (!state) {
		console.error("Invalid conversation state: ", this.state)
		return
	}
	if (state.handleMessage) {
		return state.handleMessage.call(this, text, attachments) !== false
	}
	else {
		return false
	}
}

// FIXME de-dup
Conversation.prototype.handlePostback = function(payload, referral) {
	const state = states[this.state]
	if (!state) {
		console.error("Invalid conversation state: ", this.state)
		return
	}
	if (state.handlePostback) {
		return state.handlePostback.call(this, payload, referral) !== false
	}
	else {
		return false
	}
}

// FIXME de-dup
Conversation.prototype.handleReferral = function(referral) {
	const state = states[this.state]
	if (!state) {
		console.error("Invalid conversation state: ", this.state)
		return
	}
	if (state.handleReferral) {
		return state.handleReferral.call(this, referral) !== false
	}
	else {
		return false
	}
}


Conversation.prototype.sendGenericTemplate = function(properties) {
	api.sendGenericTemplate(this.userId, properties)
}


Conversation.prototype.sendTextMessage = function(message, properties) {
	api.sendTextMessage(this.userId, message, properties)
}
