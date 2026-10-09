import React from 'react';
import {
	Html,
	Head,
	Container,
	Preview,
	Tailwind,
	Font,
	Body,
	Section,
	Text,
	Hr,
	Button
} from '@react-email/components';
import { EmailBaseProps } from 'common/types';

interface Props extends EmailBaseProps {
	children: React.ReactNode;
}

interface SalutationProps {
	name?: string;
}

interface OTPProps {
	code: string;
}

interface CTAButtonProps {
	text: string;
	url: string;
}

export const CN = {
	text: 'text-[#525f7f] text-base text-left',
	anchor: 'text-primary underline underline-offset-2',
	button:
		'bg-[#000] rounded-md text-primary text-base font-semibold font-poppins decoration-0 text-center block w-full py-2',
	hr: 'my-5 mx-0 border border-[#e6ebf1]'
};

const MainLayout = ({
	children,
	subject = 'Email Title',
	preview,
	appName = 'API Starter',
	footerText = 'API Starter, 354 Oyster Point Blvd, South San Francisco, CA 94080'
}: Props) => {
	return (
		<Html lang="en">
			<Head>
				<title>{subject}</title>
				<link rel="preconnect" href="http://fonts.googleapis.com" />
				<link rel="preconnect" href="http://fonts.gstatic.com" crossOrigin="" />
				<Font
					fontFamily="Poppins"
					fallbackFontFamily="Verdana"
					webFont={{
						url: 'https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Raleway:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap',
						format: 'opentype'
					}}
				/>
			</Head>
			{preview && <Preview>{preview}</Preview>}
			<Tailwind
				config={{
					theme: {
						extend: {
							colors: {
								primary: '#ffd54a'
							},
							fontFamily: {
								poppins: ['Poppins', 'Verdana', 'sans-serif']
							}
						}
					}
				}}
			>
				<Body className="bg-[#f6f9fc] font-poppins py-10">
					<Container className="px-0 pt-5 pb-12 mx-auto my-0 bg-white border border-gray-100 border-solid rounded-md shadow-md">
						<Section className="px-12 py-0">
							{/* Text wordmark: swap in an <Img> once the project has a hosted logo. */}
							<Text className="text-xl font-semibold text-[#333]">
								{appName}
							</Text>
							<Hr className={CN.hr} />
							{children}
							<Text className={CN.text}>— {appName} Team</Text>
							<Hr className={CN.hr} />
							<Text className="text-[#8898aa] text-xs">{footerText}</Text>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
};

export const Salutation = ({ name }: SalutationProps) =>
	name ? (
		<Text className={CN.text}>
			Hi <strong className="font-semibold">{name}</strong>,
		</Text>
	) : (
		<Text className={CN.text}>Hi,</Text>
	);

export const OTP = ({ code }: OTPProps) => (
	<Text className={CN.text}>
		One Time Code: <strong className="font-semibold">{code}</strong>
	</Text>
);

export const CTAButton = ({ text, url }: CTAButtonProps) => (
	<Button href={url} className={CN.button} target="_blank" rel="noreferrer">
		{text}
	</Button>
);

export const CTAFallback = ({ url }: { url: string }) => (
	<>
		<Text className={CN.text}>
			If the button above doesn't work, copy and paste the link below into your
			browser:
		</Text>
		<Text
			className={`text-xs underline underline-offset-2 text-[#8898aa] select-all break-all`}
		>
			{url}
		</Text>
	</>
);

export default MainLayout;
