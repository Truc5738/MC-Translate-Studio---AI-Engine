import{NextResponse}from"next/server";
import{requireAdmin}from"@/lib/security";
import{getAIKeys}from"@/lib/keys";
import{poolStatus}from"@/lib/ai-pool";
export async function GET(){if(!(await requireAdmin()))return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({keys:poolStatus(await getAIKeys())});}