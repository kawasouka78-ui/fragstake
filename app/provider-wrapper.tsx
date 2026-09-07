'use client';
import {AccountProvider} from './account-context';
export default function AccountProviderWrapper({children}:{children:React.ReactNode}){return <AccountProvider>{children}</AccountProvider>}
