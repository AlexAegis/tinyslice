// managed-by-autotool

/** @type {import('stylelint').Config} */
module.exports = {
	extends: ['@alexaegis/stylelint-config'],
	rules: {
		'selector-pseudo-class-no-unknown': [
			true,
			{
				ignorePseudoClasses: ['global'],
			},
		],
	},
};
